import type { ValidatedKubernetesRunnerSnapshot } from '../schemas/kubernetesSchema.js';

let latestSnapshot: ValidatedKubernetesRunnerSnapshot | null = null;
let lastHeartbeatAt: number | null = null;

const HEARTBEAT_TIMEOUT_MS = 30_000;

export function saveKubernetesRunnerSnapshot(
  snapshot: ValidatedKubernetesRunnerSnapshot,
): void {
  latestSnapshot = snapshot;
  lastHeartbeatAt = Date.now();
}

export function clearKubernetesRunnerSnapshot(): void {
  latestSnapshot = null;
  lastHeartbeatAt = null;
}

export function getKubernetesRunnerSnapshot() {
  const online =
    lastHeartbeatAt !== null &&
    Date.now() - lastHeartbeatAt <= HEARTBEAT_TIMEOUT_MS;

  return {
    online,
    lastHeartbeat: lastHeartbeatAt
      ? new Date(lastHeartbeatAt).toISOString()
      : null,
    snapshot: latestSnapshot,
  };
}
