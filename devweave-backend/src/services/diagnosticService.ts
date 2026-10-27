export interface DiagnosticFix {
  title: string;
  description: string;
  command?: string;
  codeSnippet?: string;
  context?: 'bash' | 'powershell' | 'docker' | 'kubernetes' | 'config';
  verification?: string;
}

export interface DiagnosticResult {
  engineType: 'RULE_BASED_DIAGNOSTIC_ENGINE' | 'AI_ASSISTED_DIAGNOSTIC_ENGINE';
  isAIGenerated: boolean;
  signature: string;
  category:
    | 'DEPENDENCY_RESOLUTION'
    | 'NETWORK_CONNECTIVITY'
    | 'COMPILATION_ERROR'
    | 'TEST_FAILURE'
    | 'DOCKER_CONTAINER'
    | 'KUBERNETES'
    | 'AUTHENTICATION'
    | 'MEMORY_EXHAUSTION'
    | 'CONFIGURATION'
    | 'HEALTH_CHECK'
    | 'PIPELINE_FAILURE'
    | 'UNKNOWN';
  title: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  rootCause: string;
  pinpointedLogSnippet?: string;
  recommendedFixes: DiagnosticFix[];
  preventionGuideline: string;
  confidenceScore?: number;
}

export function diagnoseBuildLog(logText: string): DiagnosticResult {
  const text = logText || '';
  const lower = text.toLowerCase();

  // 1. Vitest / npm ci devDependencies missing
  if (text.includes('vitest: not found') || (text.includes('sh: 1:') && text.includes('vitest'))) {
    return {
      engineType: 'RULE_BASED_DIAGNOSTIC_ENGINE',
      isAIGenerated: false,
      signature: 'RULE_VITEST_NOT_FOUND',
      category: 'DEPENDENCY_RESOLUTION',
      title: 'Missing Vitest Binary in CI Execution Context',
      severity: 'CRITICAL',
      confidenceScore: 0.98,
      rootCause:
        'The CI runner executed "npm test", but the vitest binary was not found in node_modules/.bin/vitest. This occurs when "npm ci" is executed in the repository root instead of the backend subdirectory, or when NODE_ENV=production causes npm to omit devDependencies.',
      pinpointedLogSnippet: 'sh: 1: vitest: not found',
      recommendedFixes: [
        {
          title: 'Include devDependencies in CI Install',
          description: 'Update the pipeline install command to force development dependency installation even in CI environments.',
          command: 'npm ci --include=dev',
          context: 'bash',
          verification: 'npx vitest --version',
        },
        {
          title: 'Ensure Execution in Target Subdirectory',
          description: 'Wrap the install and test stages inside dir("devweave-backend") in your Jenkinsfile.',
          codeSnippet: `dir('devweave-backend') {
    sh 'npm ci --include=dev'
    sh 'npm test --if-present'
}`,
          context: 'config',
          verification: 'ls -la node_modules/.bin/vitest',
        },
      ],
      preventionGuideline:
        'Always set NODE_ENV=test in automated testing pipeline stages and verify workspace directory before running package-manager scripts.',
    };
  }

  // 2. TypeScript compilation error
  if (text.includes('error TS') || text.includes('tsc -b') || text.includes('tsc')) {
    const match = text.match(/(.*?\.(?:ts|tsx))\((.*?)\):\s*error\s*(TS\d+):\s*(.*)/);
    const file = match ? match[1] : 'TypeScript Source';
    const line = match ? match[2] : 'unknown line';
    const code = match ? match[3] : 'TS error';
    const msg = match ? match[4] : 'Type checking failed';

    return {
      engineType: 'RULE_BASED_DIAGNOSTIC_ENGINE',
      isAIGenerated: false,
      signature: 'RULE_TYPESCRIPT_COMPILATION_ERROR',
      category: 'COMPILATION_ERROR',
      title: `TypeScript Compilation Failure (${code})`,
      severity: 'HIGH',
      confidenceScore: 0.95,
      rootCause: `Static type checking failed in ${file} at line ${line}. Error: ${msg}`,
      pinpointedLogSnippet: match ? match[0] : 'error TS: Type checking failed',
      recommendedFixes: [
        {
          title: 'Reproduce and Validate Locally',
          description: 'Execute typechecking directly without generating JavaScript emit files.',
          command: 'npx tsc --noEmit',
          context: 'bash',
          verification: 'npm run build',
        },
        {
          title: 'Clean Unused Variables & Mismatched Types',
          description: 'DevWeave enforces strict TypeScript rules (noUnusedLocals). Remove unused imports and adjust the assigned variable type.',
          codeSnippet: `// Example: Align interface property types
interface UserData {
  id: string;
  count: number; // Ensure matching type assignment
}`,
          context: 'config',
          verification: 'npx tsc --project tsconfig.json --noEmit',
        },
      ],
      preventionGuideline:
        'Configure a pre-commit Git hook running "tsc --noEmit" to catch compiler mismatches before pushing.',
    };
  }

  // 3. Network Connection Refused / Port Block
  if (
    text.includes('ECONNREFUSED') ||
    text.includes('connectex') ||
    text.includes('Connection refused') ||
    text.includes('timed out after')
  ) {
    return {
      engineType: 'RULE_BASED_DIAGNOSTIC_ENGINE',
      isAIGenerated: false,
      signature: 'RULE_NETWORK_CONNECTION_REFUSED',
      category: 'NETWORK_CONNECTIVITY',
      title: 'Target Service Connection Refused / Network Timeout',
      severity: 'CRITICAL',
      confidenceScore: 0.94,
      rootCause:
        'The client or backend attempted to connect to a service address (e.g. Jenkins runner, PostgreSQL, or local port) that is either offline, not listening on the expected interface (0.0.0.0), or blocked by firewall/security group rules.',
      pinpointedLogSnippet: text.match(/.*(?:ECONNREFUSED|connectex|timed out).*/)?.[0] || 'Connection refused',
      recommendedFixes: [
        {
          title: 'Verify Target Service Daemon Liveness',
          description: 'Confirm the service process is running and actively bound to the target port.',
          command: 'curl -I http://localhost:8080/api/health',
          context: 'bash',
          verification: 'netstat -ano | findstr 8080',
        },
        {
          title: 'Inspect Firewall & Network Security Rules',
          description: 'If targeting a remote cloud VM, ensure inbound security group rules allow traffic on the designated TCP port.',
          command: 'curl -v telnet://98.70.58.149:8080',
          context: 'bash',
          verification: 'nc -zv 98.70.58.149 8080',
        },
      ],
      preventionGuideline:
        'Always implement retry backoffs and health checks before sending synchronous pipeline build commands.',
    };
  }

  // 4. Docker daemon offline
  if (
    text.includes('Cannot connect to the Docker daemon') ||
    text.includes('pipe/dockerDesktop') ||
    text.includes('docker: command not found')
  ) {
    return {
      engineType: 'RULE_BASED_DIAGNOSTIC_ENGINE',
      isAIGenerated: false,
      signature: 'RULE_DOCKER_DAEMON_OFFLINE',
      category: 'DOCKER_CONTAINER',
      title: 'Docker Engine Offline or Daemon Unreachable',
      severity: 'HIGH',
      confidenceScore: 0.96,
      rootCause:
        'Docker CLI is present but cannot communicate with the Docker daemon socket (named pipe or /var/run/docker.sock).',
      pinpointedLogSnippet: 'Cannot connect to the Docker daemon at unix:///var/run/docker.sock',
      recommendedFixes: [
        {
          title: 'Start Docker Desktop / Engine Service',
          description: 'Launch Docker Desktop on Windows or restart the docker systemd unit on Linux.',
          command: 'sudo systemctl start docker',
          context: 'bash',
          verification: 'docker info',
        },
        {
          title: 'Verify Local Windows Runner Daemon',
          description: 'Ensure the local desktop runner is executing in your backend directory.',
          command: 'npm run runner:docker',
          context: 'powershell',
          verification: 'docker ps',
        },
      ],
      preventionGuideline:
        'Verify Docker daemon liveness using "docker info" in pipeline pre-flight checks before executing container build stages.',
    };
  }

  // 5. Memory exhaustion
  if (text.includes('JavaScript heap out of memory') || text.includes('OutOfMemoryError')) {
    return {
      engineType: 'RULE_BASED_DIAGNOSTIC_ENGINE',
      isAIGenerated: false,
      signature: 'RULE_MEMORY_EXHAUSTION',
      category: 'MEMORY_EXHAUSTION',
      title: 'Process Memory Exhaustion (OOM)',
      severity: 'CRITICAL',
      confidenceScore: 0.95,
      rootCause: 'Node.js or Java runtime exceeded heap memory quota during compilation or test execution.',
      pinpointedLogSnippet: 'FATAL ERROR: Ineffective mark-compacts near heap limit Allocation failed - JavaScript heap out of memory',
      recommendedFixes: [
        {
          title: 'Increase Node Heap Space',
          description: 'Expand the default memory allocation via NODE_OPTIONS in CI environment.',
          command: 'export NODE_OPTIONS="--max-old-space-size=4096"',
          context: 'bash',
          verification: 'node -e "console.log(v8.getHeapStatistics().heap_size_limit / 1024 / 1024)"',
        },
      ],
      preventionGuideline: 'Monitor memory utilization in CI build nodes and avoid unbounded bundle sizes.',
    };
  }

  // 6. Kubernetes CrashLoopBackOff
  if (
    lower.includes('crashloopbackoff') ||
    lower.includes('back-off restarting failed container') ||
    lower.includes('exit code 137') ||
    lower.includes('oomkilled')
  ) {
    return {
      engineType: 'RULE_BASED_DIAGNOSTIC_ENGINE',
      isAIGenerated: false,
      signature: 'RULE_K8S_CRASHLOOP_BACKOFF',
      category: 'KUBERNETES',
      title: 'Kubernetes Pod in CrashLoopBackOff State',
      severity: 'CRITICAL',
      confidenceScore: 0.97,
      rootCause:
        'The container process initialized but exited immediately with a non-zero termination status or was killed by the Linux kernel OOMKiller (Exit code 137). Common causes include missing entrypoint scripts, unhandled uncaught exceptions on startup, or insufficient container memory limits.',
      pinpointedLogSnippet: 'Error: CrashLoopBackOff: Back-off 5m0s restarting failed container',
      recommendedFixes: [
        {
          title: 'Inspect Previous Pod Crash Logs',
          description: 'Fetch stdout/stderr of the crashed container instance before restart.',
          command: 'kubectl logs <pod-name> -n default --previous',
          context: 'kubernetes',
          verification: 'kubectl describe pod <pod-name> -n default',
        },
        {
          title: 'Increase Container Resource Limits in Deployment',
          description: 'Adjust resource requests and limits in the deployment YAML specification.',
          codeSnippet: `resources:
  requests:
    memory: "256Mi"
    cpu: "200m"
  limits:
    memory: "512Mi"
    cpu: "500m"`,
          context: 'config',
          verification: 'kubectl get pod <pod-name> -o jsonpath="{.status.containerStatuses[0].state}"',
        },
      ],
      preventionGuideline:
        'Configure appropriate initial delay seconds on liveness and readiness probes to prevent premature health-check kills during startup.',
    };
  }

  // 7. Kubernetes ImagePullBackOff / ErrImagePull
  if (
    lower.includes('imagepullbackoff') ||
    lower.includes('errimagepull') ||
    lower.includes('failed to pull image') ||
    lower.includes('manifest unknown')
  ) {
    return {
      engineType: 'RULE_BASED_DIAGNOSTIC_ENGINE',
      isAIGenerated: false,
      signature: 'RULE_K8S_IMAGE_PULL_ERROR',
      category: 'KUBERNETES',
      title: 'Kubernetes Image Pull Failure (ImagePullBackOff)',
      severity: 'HIGH',
      confidenceScore: 0.96,
      rootCause:
        'The kubelet was unable to retrieve the container image from the registry. This occurs when the image tag is non-existent, the registry URL is misspelled, or private registry pull credentials (imagePullSecrets) are missing.',
      pinpointedLogSnippet: 'Failed to pull image "myrepo/app:v1.2.9": rpc error: code = NotFound desc = failed to pull and unpack image: manifest unknown',
      recommendedFixes: [
        {
          title: 'Inspect Detailed Kubelet Pull Event',
          description: 'View the exact registry rejection message and error code.',
          command: 'kubectl describe pod <pod-name> -n default | grep -A 5 Events',
          context: 'kubernetes',
          verification: 'kubectl get events -n default --sort-by=.metadata.creationTimestamp',
        },
        {
          title: 'Attach Docker Registry Secret (If Private)',
          description: 'Create and reference an imagePullSecret in the pod template spec.',
          command: 'kubectl create secret docker-registry regcred --docker-server=https://index.docker.io/v1/ --docker-username=<user> --docker-password=<token> -n default',
          context: 'kubernetes',
          verification: 'kubectl get secret regcred -n default',
        },
      ],
      preventionGuideline:
        'Use semantic versioned immutable tags rather than ":latest" and test image accessibility via CLI before deploying to Kubernetes.',
    };
  }

  // 8. Docker Image Build Failure
  if (
    lower.includes('failed to solve with frontend dockerfile') ||
    lower.includes('executor failed running') ||
    lower.includes('copy failed: file not found') ||
    (lower.includes('step ') && lower.includes('failed'))
  ) {
    return {
      engineType: 'RULE_BASED_DIAGNOSTIC_ENGINE',
      isAIGenerated: false,
      signature: 'RULE_DOCKER_BUILD_FAILED',
      category: 'DOCKER_CONTAINER',
      title: 'Docker Image Build Pipeline Step Failed',
      severity: 'HIGH',
      confidenceScore: 0.93,
      rootCause:
        'Docker BuildKit failed during layer execution. A build command returned a non-zero exit code or a COPY/ADD instruction targeted files outside the build context or excluded by .dockerignore.',
      pinpointedLogSnippet: 'ERROR: failed to solve: process "/bin/sh -c npm run build" did not complete successfully: exit code: 1',
      recommendedFixes: [
        {
          title: 'Run Build Locally with Verbose Plain Output',
          description: 'Bypass cached layers and inspect unbuffered stdout/stderr of the failing build step.',
          command: 'docker build --progress=plain --no-cache -t app:debug .',
          context: 'docker',
          verification: 'docker images app:debug',
        },
        {
          title: 'Verify Context and .dockerignore Inclusions',
          description: 'Ensure source files required by the build stage are not accidentally excluded.',
          command: 'cat .dockerignore',
          context: 'bash',
        },
      ],
      preventionGuideline:
        'Use multi-stage Docker builds to isolate build toolchains from minimal runtime images and verify layer cache predictability.',
    };
  }

  // 9. Failed Health Check
  if (
    lower.includes('health check failed') ||
    lower.includes('unhealthy') ||
    lower.includes('liveness probe failed') ||
    lower.includes('readiness probe failed')
  ) {
    return {
      engineType: 'RULE_BASED_DIAGNOSTIC_ENGINE',
      isAIGenerated: false,
      signature: 'RULE_HEALTH_CHECK_FAILED',
      category: 'HEALTH_CHECK',
      title: 'Container Health Check or Probe Failure',
      severity: 'HIGH',
      confidenceScore: 0.94,
      rootCause:
        'The container HTTP or TCP health probe failed consecutive check cycles. The service either returned an HTTP 5xx error, timed out waiting for database readiness, or crashed during request processing.',
      pinpointedLogSnippet: 'Liveness probe failed: HTTP probe failed with statuscode: 500',
      recommendedFixes: [
        {
          title: 'Inspect Probe Output and Container Health State',
          description: 'Query Docker inspect health logs to read the exact probe response body.',
          command: 'docker inspect --format="{{json .State.Health}}" <container-id>',
          context: 'docker',
          verification: 'curl -fv http://localhost:8080/api/health',
        },
        {
          title: 'Adjust Probe Initial Delay and Grace Periods',
          description: 'Grant the application adequate startup time before probes begin firing.',
          codeSnippet: `livenessProbe:
  httpGet:
    path: /api/health
    port: 8080
  initialDelaySeconds: 15
  periodSeconds: 10`,
          context: 'config',
        },
      ],
      preventionGuideline:
        'Ensure the health check endpoint returns 200 immediately without executing heavy database transactions or external network calls.',
    };
  }

  // 10. Jenkins Pipeline Stage Abort
  if (
    lower.includes('hudson.abortexception') ||
    lower.includes('script returned exit code') ||
    lower.includes('error: build step failed')
  ) {
    return {
      engineType: 'RULE_BASED_DIAGNOSTIC_ENGINE',
      isAIGenerated: false,
      signature: 'RULE_JENKINS_STAGE_FAILURE',
      category: 'PIPELINE_FAILURE',
      title: 'Jenkins Pipeline Stage Terminated with Failure Status',
      severity: 'HIGH',
      confidenceScore: 0.92,
      rootCause:
        'A shell script or tool execution step in the Jenkinsfile returned a non-zero exit code. Jenkins aborted subsequent pipeline stages according to standard fail-fast semantics.',
      pinpointedLogSnippet: 'script returned exit code 1\nhudson.AbortException: script returned exit code 1',
      recommendedFixes: [
        {
          title: 'Fetch Raw Jenkins Console Output',
          description: 'Inspect the last 50 lines preceding the abort exception to locate the root failure.',
          command: 'curl -s -u $JENKINS_USER:$JENKINS_TOKEN $JENKINS_URL/job/DevWeave-CI-CD/lastBuild/consoleText | tail -n 50',
          context: 'bash',
          verification: 'curl -s -u $JENKINS_USER:$JENKINS_TOKEN $JENKINS_URL/job/DevWeave-CI-CD/lastBuild/api/json',
        },
      ],
      preventionGuideline:
        'Wrap volatile pipeline steps in try-catch or catchError blocks in your Declarative Jenkinsfile to produce clear failure diagnostic reports.',
    };
  }

  // 11. Missing Environment Variables
  if (
    lower.includes('environment variable is required') ||
    lower.includes('missing required environment variable') ||
    lower.includes('key is required') ||
    lower.includes('invalid environment variables configuration')
  ) {
    return {
      engineType: 'RULE_BASED_DIAGNOSTIC_ENGINE',
      isAIGenerated: false,
      signature: 'RULE_MISSING_ENV_VARS',
      category: 'CONFIGURATION',
      title: 'Missing Required Environment Variables',
      severity: 'CRITICAL',
      confidenceScore: 0.96,
      rootCause:
        'The application schema validator (Zod or dotenv) halted process startup because one or more mandatory environment configuration variables (e.g. DATABASE_URL, JWT_SECRET, or PORT) are unset or empty.',
      pinpointedLogSnippet: '❌ Invalid environment variables configuration:\nDATABASE_URL: DATABASE_URL environment variable is required',
      recommendedFixes: [
        {
          title: 'Configure .env in Working Directory',
          description: 'Ensure a valid .env file exists with all required configuration parameters.',
          codeSnippet: `DATABASE_URL=postgresql://user:password@localhost:5432/devweave
JWT_SECRET=devweave_jwt_secret_key_development_only
FRONTEND_URL=http://localhost:5173`,
          context: 'config',
          verification: 'npm run test',
        },
      ],
      preventionGuideline:
        'Maintain a committed .env.example with dummy placeholders and validate configuration at build time.',
    };
  }

  // 12. Dependency Resolution (npm ERESOLVE)
  if (
    text.includes('code ERESOLVE') ||
    lower.includes('could not resolve dependency') ||
    lower.includes('conflicting peer dependency')
  ) {
    return {
      engineType: 'RULE_BASED_DIAGNOSTIC_ENGINE',
      isAIGenerated: false,
      signature: 'RULE_DEPENDENCY_RESOLUTION_ERESOLVE',
      category: 'DEPENDENCY_RESOLUTION',
      title: 'npm Peer Dependency Conflict (ERESOLVE)',
      severity: 'HIGH',
      confidenceScore: 0.95,
      rootCause:
        'npm 7+ strict peer dependency resolution blocked package installation due to incompatible version requirements between installed libraries.',
      pinpointedLogSnippet: 'npm ERR! code ERESOLVE\nnpm ERR! ERESOLVE could not resolve\nnpm ERR! Conflicting peer dependency: react@19.0.0',
      recommendedFixes: [
        {
          title: 'Install with Legacy Peer Dependencies Flag',
          description: 'Instruct npm to bypass peer dependency conflicts when installing packages.',
          command: 'npm install --legacy-peer-deps',
          context: 'bash',
          verification: 'npm ls --depth=0',
        },
      ],
      preventionGuideline:
        'Verify package version compatibility with active React or Node.js versions before adding new third-party dependencies.',
    };
  }

  // Default Fallback
  return {
    engineType: 'RULE_BASED_DIAGNOSTIC_ENGINE',
    isAIGenerated: false,
    signature: 'RULE_GENERAL_PIPELINE_TRIAGE',
    category: 'UNKNOWN',
    title: 'General Execution Triage Analysis',
    severity: 'MEDIUM',
    confidenceScore: 0.65,
    rootCause:
      'Log output does not match an established automated failure signature. Review the recent stage exit codes and stdout/stderr output.',
    recommendedFixes: [
      {
        title: 'Check Stage Exit Codes',
        description: 'Locate the earliest stage reporting non-zero status in the console log view.',
        context: 'bash',
      },
      {
        title: 'Inspect Environment Variables',
        description: 'Verify all required credentials, database URLs, and API tokens are configured in the job.',
        context: 'config',
      },
    ],
    preventionGuideline:
      'Enable verbose logging flags (e.g. npm test -- --verbose) to capture granular stack traces.',
  };
}
