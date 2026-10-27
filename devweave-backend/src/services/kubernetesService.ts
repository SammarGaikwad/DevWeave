import { exec } from 'child_process';
import { promisify } from 'util';
import YAML from 'yaml';
import { getKubernetesRunnerSnapshot } from './kubernetesRunnerService.js';

const execAsync = promisify(exec);

export interface ClusterStatus {
  kubectlInstalled: boolean;
  clientVersion: string | null;
  clusterConnected: boolean;
  currentContext: string | null;
  clusterEndpoint: string | null;
  serverVersion: string | null;
  status: 'CONNECTED' | 'DISCONNECTED' | 'CLI_NOT_FOUND';
  message: string;
  setupInstructions: string[];
}

export interface K8sManifestTemplate {
  id: string;
  name: string;
  kind: string;
  apiVersion: string;
  description: string;
  content: string;
  bestPractices: string[];
}

export interface K8sCustomOptions {
  serviceName: string;
  namespace: string;
  imageTag: string;
  containerPort: number;
  replicas: number;
  cpuRequest: string;
  cpuLimit: string;
  memoryRequest: string;
  memoryLimit: string;
  enableIngress: boolean;
  ingressHost: string;
  enableHpa: boolean;
  minReplicas: number;
  maxReplicas: number;
}

export const K8S_TEMPLATES: Record<string, K8sManifestTemplate> = {
  deployment: {
    id: 'deployment',
    name: 'Production Deployment with Probes & Security Context',
    kind: 'Deployment',
    apiVersion: 'apps/v1',
    description: 'Zero-downtime RollingUpdate deployment with non-root security context, liveness/readiness probes, and resource constraints.',
    content: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: devweave-service
  namespace: default
  labels:
    app.kubernetes.io/name: devweave-service
    app.kubernetes.io/part-of: devweave-platform
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  selector:
    matchLabels:
      app: devweave-service
  template:
    metadata:
      labels:
        app: devweave-service
    spec:
      securityContext:
        runAsNonRoot: true
        runAsUser: 10001
        fsGroup: 10001
      containers:
        - name: service
          image: devweave/service:latest
          imagePullPolicy: IfNotPresent
          ports:
            - name: http
              containerPort: 8080
              protocol: TCP
          resources:
            requests:
              cpu: "100m"
              memory: "128Mi"
            limits:
              cpu: "500m"
              memory: "512Mi"
          livenessProbe:
            httpGet:
              path: /api/health
              port: http
            initialDelaySeconds: 15
            periodSeconds: 10
          readinessProbe:
            httpGet:
              path: /api/health
              port: http
            initialDelaySeconds: 5
            periodSeconds: 5`,
    bestPractices: [
      'maxUnavailable: 0 guarantees zero dropped requests during rolling upgrades',
      'Explicit resource requests and limits prevent noisy neighbor starvation',
      'runAsNonRoot: true prevents container privilege escalation to node host',
      'Liveness and readiness probes route traffic only to healthy pods',
    ],
  },

  service: {
    id: 'service',
    name: 'ClusterIP & LoadBalancer Service',
    kind: 'Service',
    apiVersion: 'v1',
    description: 'Internal routing abstraction mapping incoming requests to target pods on defined ports.',
    content: `apiVersion: v1
kind: Service
metadata:
  name: devweave-service
  namespace: default
  labels:
    app.kubernetes.io/name: devweave-service
spec:
  type: ClusterIP
  ports:
    - name: http
      port: 80
      targetPort: 8080
      protocol: TCP
  selector:
    app: devweave-service`,
    bestPractices: [
      'Uses ClusterIP for private internal networking behind Ingress controller',
      'Named targetPort allows decoupling pod port changes from service definitions',
    ],
  },

  ingress: {
    id: 'ingress',
    name: 'Ingress Controller with TLS / Let\'s Encrypt',
    kind: 'Ingress',
    apiVersion: 'networking.k8s.io/v1',
    description: 'HTTP/HTTPS path-based reverse proxy routing with cert-manager automated TLS encryption.',
    content: `apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: devweave-ingress
  namespace: default
  annotations:
    kubernetes.io/ingress.class: nginx
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
spec:
  tls:
    - hosts:
        - app.devweave.internal
      secretName: devweave-tls-cert
  rules:
    - host: app.devweave.internal
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: devweave-service
                port:
                  number: 80`,
    bestPractices: [
      'Enforces SSL redirect to guarantee all client communication is encrypted',
      'Integrates cert-manager for automated Zero-Touch TLS certificate rotation',
    ],
  },

  hpa: {
    id: 'hpa',
    name: 'Horizontal Pod Autoscaler (HPA v2)',
    kind: 'HorizontalPodAutoscaler',
    apiVersion: 'autoscaling/v2',
    description: 'Dynamically scales replica count up and down based on real-time CPU and Memory utilization.',
    content: `apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: devweave-hpa
  namespace: default
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: devweave-service
  minReplicas: 2
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 75
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80`,
    bestPractices: [
      'Autoscaling eliminates manual intervention during traffic spikes',
      'Dual metric triggers (CPU & Memory) handle compute-bound and memory-leak scenarios',
    ],
  },

  configmap: {
    id: 'configmap',
    name: 'Environment ConfigMap',
    kind: 'ConfigMap',
    apiVersion: 'v1',
    description: 'Externalizes runtime configuration parameters from container image.',
    content: `apiVersion: v1
kind: ConfigMap
metadata:
  name: devweave-config
  namespace: default
data:
  NODE_ENV: "production"
  PORT: "8080"
  LOG_LEVEL: "info"
  ENABLE_METRICS: "true"`,
    bestPractices: [
      'Follows Twelve-Factor App methodology by externalizing configuration',
      'Decouples environment configs across Staging, Production, and DR clusters',
    ],
  },
};

export async function checkClusterStatus(): Promise<ClusterStatus> {
  const runnerState = getKubernetesRunnerSnapshot();
  if (runnerState.online && runnerState.snapshot) {
    const snap = runnerState.snapshot;
    if (snap.clusterConnected) {
      return {
        kubectlInstalled: true,
        clientVersion: snap.kubectlVersion || 'Installed',
        clusterConnected: true,
        currentContext: snap.currentContext || 'default',
        clusterEndpoint: snap.clusterEndpoint || null,
        serverVersion: snap.serverVersion || 'Connected',
        status: 'CONNECTED',
        message: `Connected to Kubernetes cluster via runner "${snap.runnerId}" (context: "${snap.currentContext || 'default'}").`,
        setupInstructions: [],
      };
    } else {
      return {
        kubectlInstalled: !!snap.kubectlVersion,
        clientVersion: snap.kubectlVersion || null,
        clusterConnected: false,
        currentContext: snap.currentContext || null,
        clusterEndpoint: null,
        serverVersion: null,
        status: 'DISCONNECTED',
        message: snap.error || 'Kubernetes runner is online, but no live cluster is currently reachable.',
        setupInstructions: [
          'Ensure Kubernetes is enabled in Docker Desktop (Settings > Kubernetes > Enable Kubernetes)',
          'Or start a local Minikube / Kind cluster: minikube start',
          'Verify active context with: kubectl config get-contexts',
        ],
      };
    }
  }

  let clientVersion: string | null = null;
  let currentContext: string | null = null;

  try {
    const { stdout } = await execAsync('kubectl version --client --output=json', { timeout: 2000 });
    const parsed = JSON.parse(stdout);
    clientVersion = parsed.clientVersion?.gitVersion || 'Installed';
  } catch {
    return {
      kubectlInstalled: false,
      clientVersion: null,
      clusterConnected: false,
      currentContext: null,
      clusterEndpoint: null,
      serverVersion: null,
      status: 'CLI_NOT_FOUND',
      message: 'kubectl client binary was not found in PATH.',
      setupInstructions: [
        'Install kubectl using: winget install Kubernetes.kubectl (Windows) or brew install kubectl (macOS)',
        'Ensure ~/.kube/config contains your cluster credentials',
      ],
    };
  }

  try {
    const { stdout: contextOut } = await execAsync('kubectl config current-context', { timeout: 1500 });
    currentContext = contextOut.trim();
  } catch {
    currentContext = null;
  }

  try {
    const { stdout } = await execAsync('kubectl cluster-info --request-timeout=2s', { timeout: 2500 });
    const match = stdout.match(/https?:\/\/[^\s]+/);
    const clusterEndpoint = match ? match[0] : null;

    return {
      kubectlInstalled: true,
      clientVersion,
      clusterConnected: true,
      currentContext,
      clusterEndpoint,
      serverVersion: 'Connected',
      status: 'CONNECTED',
      message: `Connected to Kubernetes cluster via context "${currentContext || 'default'}".`,
      setupInstructions: [],
    };
  } catch {
    return {
      kubectlInstalled: true,
      clientVersion,
      clusterConnected: false,
      currentContext,
      clusterEndpoint: null,
      serverVersion: null,
      status: 'DISCONNECTED',
      message: 'Kubectl is installed, but no live Kubernetes cluster is currently reachable.',
      setupInstructions: [
        'Connect a local Minikube, Kind, or Docker Desktop Kubernetes cluster',
        'Or configure your cloud kubeconfig: az aks get-credentials or aws eks update-kubeconfig',
        'Verify active context with: kubectl config get-contexts',
      ],
    };
  }
}

export function generateCustomManifest(opts: K8sCustomOptions): string {
  const parts: string[] = [];

  // 1. Deployment
  parts.push(`apiVersion: apps/v1
kind: Deployment
metadata:
  name: ${opts.serviceName}
  namespace: ${opts.namespace}
  labels:
    app.kubernetes.io/name: ${opts.serviceName}
spec:
  replicas: ${opts.replicas}
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  selector:
    matchLabels:
      app: ${opts.serviceName}
  template:
    metadata:
      labels:
        app: ${opts.serviceName}
    spec:
      securityContext:
        runAsNonRoot: true
        runAsUser: 10001
      containers:
        - name: app
          image: ${opts.imageTag}
          imagePullPolicy: IfNotPresent
          ports:
            - name: http
              containerPort: ${opts.containerPort}
          resources:
            requests:
              cpu: "${opts.cpuRequest}"
              memory: "${opts.memoryRequest}"
            limits:
              cpu: "${opts.cpuLimit}"
              memory: "${opts.memoryLimit}"
          livenessProbe:
            httpGet:
              path: /api/health
              port: http
            initialDelaySeconds: 15
            periodSeconds: 10
          readinessProbe:
            httpGet:
              path: /api/health
              port: http
            initialDelaySeconds: 5
            periodSeconds: 5`);

  // 2. Service
  parts.push(`apiVersion: v1
kind: Service
metadata:
  name: ${opts.serviceName}
  namespace: ${opts.namespace}
spec:
  type: ClusterIP
  ports:
    - name: http
      port: 80
      targetPort: ${opts.containerPort}
  selector:
    app: ${opts.serviceName}`);

  // 3. Ingress (Optional)
  if (opts.enableIngress) {
    parts.push(`apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: ${opts.serviceName}-ingress
  namespace: ${opts.namespace}
  annotations:
    kubernetes.io/ingress.class: nginx
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
spec:
  rules:
    - host: ${opts.ingressHost}
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: ${opts.serviceName}
                port:
                  number: 80`);
  }

  // 4. HPA (Optional)
  if (opts.enableHpa) {
    parts.push(`apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: ${opts.serviceName}-hpa
  namespace: ${opts.namespace}
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: ${opts.serviceName}
  minReplicas: ${opts.minReplicas}
  maxReplicas: ${opts.maxReplicas}
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 80`);
  }

  return parts.join('\n---\n');
}

export interface K8sParsedResource {
  apiVersion: string;
  kind: string;
  name: string;
  namespace?: string;
}

export function validateK8sYaml(yamlContent: string): {
  valid: boolean;
  errors: string[];
  parsedDocuments: number;
  resources: K8sParsedResource[];
} {
  const errors: string[] = [];
  const resources: K8sParsedResource[] = [];

  if (!yamlContent || !yamlContent.trim()) {
    return { valid: false, errors: ['Manifest is empty.'], parsedDocuments: 0, resources: [] };
  }

  let docs: YAML.Document.Parsed[];
  try {
    docs = YAML.parseAllDocuments(yamlContent);
  } catch (err: any) {
    return { valid: false, errors: [`YAML Syntax Error: ${err.message}`], parsedDocuments: 0, resources: [] };
  }

  if (docs.length === 0) {
    return { valid: false, errors: ['Manifest is empty.'], parsedDocuments: 0, resources: [] };
  }

  docs.forEach((doc, idx) => {
    const docNumber = idx + 1;
    if (doc.errors && doc.errors.length > 0) {
      doc.errors.forEach((e) => {
        errors.push(`Document #${docNumber} YAML error: ${e.message} at line ${e.linePos?.[0]?.line || '?'}`);
      });
      return;
    }

    const json = doc.toJSON();
    if (!json || typeof json !== 'object') {
      errors.push(`Document #${docNumber} is not a valid Kubernetes object.`);
      return;
    }

    if (!json.apiVersion || typeof json.apiVersion !== 'string') {
      errors.push(`Document #${docNumber} is missing "apiVersion".`);
    }

    if (!json.kind || typeof json.kind !== 'string') {
      errors.push(`Document #${docNumber} is missing "kind".`);
    }

    if (!json.metadata || typeof json.metadata !== 'object') {
      errors.push(`Document #${docNumber} is missing "metadata" block.`);
    } else if (!json.metadata.name || typeof json.metadata.name !== 'string') {
      errors.push(`Document #${docNumber} is missing "metadata.name".`);
    }

    // Consistency checks
    if (json.kind === 'Deployment' && json.spec) {
      const matchLabels = json.spec.selector?.matchLabels;
      const templateLabels = json.spec.template?.metadata?.labels;
      if (matchLabels && templateLabels) {
        for (const [k, v] of Object.entries(matchLabels)) {
          if (templateLabels[k] !== v) {
            errors.push(
              `Document #${docNumber} (Deployment "${json.metadata?.name}"): selector label "${k}=${v}" does not match template label "${k}=${templateLabels[k]}".`
            );
          }
        }
      }
    }

    if (json.apiVersion && json.kind && json.metadata?.name) {
      resources.push({
        apiVersion: json.apiVersion,
        kind: json.kind,
        name: json.metadata.name,
        namespace: json.metadata.namespace,
      });
    }
  });

  return {
    valid: errors.length === 0,
    errors,
    parsedDocuments: docs.length,
    resources,
  };
}

