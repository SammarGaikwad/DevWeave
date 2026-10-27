import { AppError } from '../middleware/errorHandler.js';

export const PROTECTED_K8S_NAMESPACES = new Set([
  'kube-system',
  'kube-public',
  'kube-node-lease',
  'default',
]);

export interface KubernetesAuditEvent {
  id: string;
  timestamp: string;
  userId: string;
  userEmail?: string;
  action: string;
  resourceKind: string;
  resourceName: string;
  namespace?: string;
  status: 'ATTEMPT' | 'BLOCKED_PROTECTION' | 'SUCCESS' | 'FAILED';
  details?: Record<string, any>;
  error?: string;
}

const auditLogBuffer: KubernetesAuditEvent[] = [];
const MAX_AUDIT_LOGS = 1000;

export function recordKubernetesAuditEvent(
  event: Omit<KubernetesAuditEvent, 'id' | 'timestamp'>,
): KubernetesAuditEvent {
  const fullEvent: KubernetesAuditEvent = {
    id: `k8s_audit_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    timestamp: new Date().toISOString(),
    ...event,
  };

  auditLogBuffer.unshift(fullEvent);
  if (auditLogBuffer.length > MAX_AUDIT_LOGS) {
    auditLogBuffer.length = MAX_AUDIT_LOGS;
  }

  return fullEvent;
}

export function getKubernetesAuditLogs(): KubernetesAuditEvent[] {
  return [...auditLogBuffer];
}

/**
 * Asserts that a namespace can be deleted safely.
 * Blocks kube-system, kube-public, kube-node-lease, and default.
 */
export function assertNamespaceNotProtected(namespaceName: string): void {
  const clean = namespaceName.trim().toLowerCase();
  if (PROTECTED_K8S_NAMESPACES.has(clean)) {
    throw new AppError(
      `Namespace "${namespaceName}" is a system-critical or default Kubernetes namespace and cannot be deleted.`,
      403,
    );
  }
}

/**
 * Asserts that a resource deletion or destructive action is permitted.
 */
export function assertResourceNotProtected(
  kind: string,
  name: string,
  namespace?: string,
): void {
  const normKind = kind.trim().toLowerCase();
  const normName = name.trim().toLowerCase();
  const normNs = namespace ? namespace.trim().toLowerCase() : '';

  // 1. Block deletion of default kubernetes service
  if (
    (normKind === 'service' || normKind === 'svc') &&
    normName === 'kubernetes' &&
    (!normNs || normNs === 'default')
  ) {
    throw new AppError(
      'The core "kubernetes" API service in default namespace is system-critical and cannot be deleted.',
      403,
    );
  }

  // 2. Block deletion of resources in kube-system namespace
  if (normNs === 'kube-system') {
    throw new AppError(
      `Modifying or deleting resources in the "kube-system" namespace is restricted to protect cluster integrity. Target: ${kind}/${name}.`,
      403,
    );
  }

  // 3. Block deletion of cluster-scoped nodes or protected namespaces
  if (normKind === 'namespace') {
    assertNamespaceNotProtected(name);
  }
}

/**
 * Asserts that a service creation does not collide with or overwrite core system services.
 */
export function assertServiceCreationAllowed(name: string, namespace?: string): void {
  const normName = name.trim().toLowerCase();
  const normNs = namespace ? namespace.trim().toLowerCase() : 'default';

  if (normName === 'kubernetes' && normNs === 'default') {
    throw new AppError(
      'Creating or overwriting the core system "kubernetes" service in default namespace is strictly forbidden.',
      403,
    );
  }

  if (normName === 'kube-dns' && normNs === 'kube-system') {
    throw new AppError(
      'Creating or overwriting the core cluster DNS service "kube-dns" in kube-system namespace is strictly forbidden.',
      403,
    );
  }
}

/**
 * Mask secret values in Kubernetes Secret objects.
 * Replaces base64 encoded data values with masked tokens.
 */
export function maskSecretData(secretObj: any): any {
  if (!secretObj || typeof secretObj !== 'object') return secretObj;

  const cloned = JSON.parse(JSON.stringify(secretObj));

  if (cloned.kind === 'Secret' || cloned.kind === 'secret') {
    if (cloned.data && typeof cloned.data === 'object') {
      const maskedData: Record<string, string> = {};
      for (const key of Object.keys(cloned.data)) {
        maskedData[key] = '••••••••';
      }
      cloned.data = maskedData;
    }
    if (cloned.stringData && typeof cloned.stringData === 'object') {
      const maskedStringData: Record<string, string> = {};
      for (const key of Object.keys(cloned.stringData)) {
        maskedStringData[key] = '••••••••';
      }
      cloned.stringData = maskedStringData;
    }
  }

  return cloned;
}
