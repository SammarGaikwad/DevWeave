export interface DockerRunnerSnapshot {
  runnerId: string;
  hostname: string;
  dockerVersion: string | null;
  serverVersion: string | null;
  containersRunning: number;
  containersTotal: number;
  imagesTotal: number;
  reportedAt: string;
}

let latestSnapshot: DockerRunnerSnapshot | null = null;
let lastHeartbeatAt: number | null = null;

const HEARTBEAT_TIMEOUT_MS = 30_000;

export function saveRunnerSnapshot(
  snapshot: DockerRunnerSnapshot,
): void {
  latestSnapshot = snapshot;
  lastHeartbeatAt = Date.now();
}

export function clearRunnerSnapshot(): void {
  latestSnapshot = null;
  lastHeartbeatAt = null;
}

export function getRunnerSnapshot() {
  const online =
    lastHeartbeatAt !== null &&
    Date.now() - lastHeartbeatAt <= HEARTBEAT_TIMEOUT_MS;

  return {
    online,
    lastHeartbeatAt:
      lastHeartbeatAt === null
        ? null
        : new Date(lastHeartbeatAt).toISOString(),
    snapshot: online ? latestSnapshot : null,
  };
}
