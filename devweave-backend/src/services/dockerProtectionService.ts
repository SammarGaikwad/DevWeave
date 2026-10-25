import { AppError } from '../middleware/errorHandler.js';

export const PROTECTED_CONTAINERS = new Set([
  'smart_review_backend_api',
  'smart_review_analytics_engine',
  'jenkins',
]);

export const PROTECTED_NETWORKS = new Set([
  'bridge',
  'host',
  'none',
  'smart-review-analytics_smart_review_network',
]);

export const PROTECTED_VOLUMES = new Set([
  'jenkins_home',
]);

export const PROTECTED_IMAGE_FAMILIES = [
  'jenkins/jenkins',
  'smart-review-analytics',
];

// Preserved for backward compatibility
export const PROTECTED_IMAGE_PREFIXES = PROTECTED_IMAGE_FAMILIES;

export interface DockerContainerSummary {
  id: string;
  name: string;
  image: string;
  imageId?: string;
  status: string;
  state: 'running' | 'exited' | 'paused' | 'restarting' | 'dead' | 'created';
  created: string;
  ports: Array<{ hostPort?: number; containerPort: number; protocol: string }>;
  isProtected: boolean;
  cpuPercent?: string;
  memoryUsage?: string;
}

export interface DockerImageSummary {
  id: string;
  repository: string;
  tag: string;
  size: string;
  created: string;
  inUseByContainers: string[];
  isProtected: boolean;
  isDangling: boolean;
}

export interface DockerNetworkSummary {
  id: string;
  name: string;
  driver: string;
  scope: string;
  containers: string[];
  isProtected: boolean;
}

export interface DockerVolumeSummary {
  name: string;
  driver: string;
  mountpoint?: string;
  inUseByContainers: string[];
  isProtected: boolean;
}

export interface DockerInventorySnapshot {
  containers: DockerContainerSummary[];
  images: DockerImageSummary[];
  networks: DockerNetworkSummary[];
  volumes: DockerVolumeSummary[];
  updatedAt: string;
}

export interface DockerAuditEvent {
  id: string;
  timestamp: string;
  userId: string;
  userEmail?: string;
  action: string;
  resourceType: 'container' | 'image' | 'network' | 'volume' | 'system';
  resourceName: string;
  status: 'SUCCESS' | 'FAILED' | 'BLOCKED';
  details?: Record<string, any>;
  error?: string;
}

const auditLogStore: DockerAuditEvent[] = [];
const MAX_AUDIT_LOGS = 1000;

/**
 * Safely parses image repository, tag, and optional digest from an image reference.
 */
export function parseImageRepositoryAndTag(imageRef: string): { repository: string; tag: string; digest?: string } {
  const clean = (imageRef || '').trim().replace(/^docker\.io\/(library\/)?/, '');

  if (clean.includes('@')) {
    const [repo, digest] = clean.split('@');
    return { repository: repo, tag: '<none>', digest };
  }

  const lastColonIndex = clean.lastIndexOf(':');
  const lastSlashIndex = clean.lastIndexOf('/');
  if (lastColonIndex > lastSlashIndex) {
    const repo = clean.substring(0, lastColonIndex);
    const tag = clean.substring(lastColonIndex + 1);
    return { repository: repo, tag };
  }

  return { repository: clean, tag: 'latest' };
}

/**
 * Checks whether an image repository or reference belongs to protected image families.
 */
export function isProtectedImageFamily(repoOrTagOrDigest: string): boolean {
  if (!repoOrTagOrDigest) return false;
  const { repository } = parseImageRepositoryAndTag(repoOrTagOrDigest);
  const normalizedRepo = repository.toLowerCase();

  // jenkins/jenkins family
  if (
    normalizedRepo === 'jenkins/jenkins' ||
    normalizedRepo === 'jenkins' ||
    normalizedRepo.startsWith('jenkins/jenkins:') ||
    normalizedRepo.startsWith('jenkins/') ||
    normalizedRepo.endsWith('/jenkins/jenkins') ||
    normalizedRepo.endsWith('/jenkins') ||
    normalizedRepo.includes('/jenkins/jenkins')
  ) {
    return true;
  }

  // smart-review-analytics family
  if (
    normalizedRepo === 'smart-review-analytics' ||
    normalizedRepo.startsWith('smart-review-analytics-') ||
    normalizedRepo.startsWith('smart-review-analytics/') ||
    normalizedRepo.startsWith('smart-review-analytics:') ||
    normalizedRepo.includes('smart-review-analytics')
  ) {
    return true;
  }

  return false;
}

export interface ResolutionResult<T> {
  matches: T[];
  isAmbiguous: boolean;
  resolved: T | null;
  notFound: boolean;
}

/**
 * Resolves a container reference against inventory by exact name, full ID, or ID prefix.
 */
export function resolveContainer(
  nameOrId: string,
  containers: DockerContainerSummary[]
): ResolutionResult<DockerContainerSummary> {
  const clean = (nameOrId || '').trim().replace(/^\//, '').toLowerCase();
  if (!clean) {
    return { matches: [], isAmbiguous: false, resolved: null, notFound: true };
  }

  // 1. Exact name match (highest precedence)
  const exactName = containers.filter(
    (c) => c.name.toLowerCase().replace(/^\//, '') === clean
  );
  if (exactName.length === 1) {
    return { matches: exactName, isAmbiguous: false, resolved: exactName[0], notFound: false };
  }
  if (exactName.length > 1) {
    return { matches: exactName, isAmbiguous: true, resolved: null, notFound: false };
  }

  // 2. Exact ID match (full ID)
  const cleanId = clean.replace(/^sha256:/, '');
  const exactId = containers.filter((c) => {
    const cid = c.id.toLowerCase().replace(/^sha256:/, '');
    return (
      cid === cleanId ||
      (cleanId.length >= 12 && cid.length >= 12 && (cid.startsWith(cleanId) || cleanId.startsWith(cid)))
    );
  });
  if (exactId.length === 1) {
    return { matches: exactId, isAmbiguous: false, resolved: exactId[0], notFound: false };
  }
  if (exactId.length > 1) {
    return { matches: exactId, isAmbiguous: true, resolved: null, notFound: false };
  }

  // 3. Prefix ID match
  const prefixMatches = containers.filter((c) => {
    const cid = c.id.toLowerCase().replace(/^sha256:/, '');
    return cid.startsWith(cleanId) || (cleanId.length >= 6 && cleanId.startsWith(cid));
  });

  if (prefixMatches.length === 1) {
    return { matches: prefixMatches, isAmbiguous: false, resolved: prefixMatches[0], notFound: false };
  }
  if (prefixMatches.length > 1) {
    return { matches: prefixMatches, isAmbiguous: true, resolved: null, notFound: false };
  }

  return { matches: [], isAmbiguous: false, resolved: null, notFound: true };
}

/**
 * Resolves a network reference against inventory by exact name, full ID, or ID prefix.
 */
export function resolveNetwork(
  nameOrId: string,
  networks: DockerNetworkSummary[]
): ResolutionResult<DockerNetworkSummary> {
  const clean = (nameOrId || '').trim().toLowerCase();
  if (!clean) {
    return { matches: [], isAmbiguous: false, resolved: null, notFound: true };
  }

  // 1. Exact name match
  const exactName = networks.filter((n) => n.name.toLowerCase() === clean);
  if (exactName.length === 1) {
    return { matches: exactName, isAmbiguous: false, resolved: exactName[0], notFound: false };
  }
  if (exactName.length > 1) {
    return { matches: exactName, isAmbiguous: true, resolved: null, notFound: false };
  }

  // 2. Exact ID match
  const cleanId = clean.replace(/^sha256:/, '');
  const exactId = networks.filter((n) => {
    const nid = n.id.toLowerCase().replace(/^sha256:/, '');
    return (
      nid === cleanId ||
      (cleanId.length >= 12 && nid.length >= 12 && (nid.startsWith(cleanId) || cleanId.startsWith(nid)))
    );
  });
  if (exactId.length === 1) {
    return { matches: exactId, isAmbiguous: false, resolved: exactId[0], notFound: false };
  }
  if (exactId.length > 1) {
    return { matches: exactId, isAmbiguous: true, resolved: null, notFound: false };
  }

  // 3. Prefix ID match
  const prefixMatches = networks.filter((n) => {
    const nid = n.id.toLowerCase().replace(/^sha256:/, '');
    return nid.startsWith(cleanId) || (cleanId.length >= 6 && cleanId.startsWith(nid));
  });

  if (prefixMatches.length === 1) {
    return { matches: prefixMatches, isAmbiguous: false, resolved: prefixMatches[0], notFound: false };
  }
  if (prefixMatches.length > 1) {
    return { matches: prefixMatches, isAmbiguous: true, resolved: null, notFound: false };
  }

  return { matches: [], isAmbiguous: false, resolved: null, notFound: true };
}

/**
 * Resolves an image reference against inventory by repo:tag, repository, full ID, digest, or ID prefix.
 */
export function resolveImage(
  nameOrId: string,
  images: DockerImageSummary[]
): ResolutionResult<DockerImageSummary> {
  const clean = (nameOrId || '').trim();
  if (!clean) {
    return { matches: [], isAmbiguous: false, resolved: null, notFound: true };
  }

  const { repository, tag, digest } = parseImageRepositoryAndTag(clean);
  const normalizedRepo = repository.toLowerCase();

  // 1. Exact repo:tag match
  if (clean.includes(':') && tag !== '<none>' && !clean.startsWith('sha256:')) {
    const exactTag = images.filter(
      (img) =>
        img.repository.toLowerCase() === normalizedRepo &&
        img.tag.toLowerCase() === tag.toLowerCase()
    );
    if (exactTag.length === 1) {
      return { matches: exactTag, isAmbiguous: false, resolved: exactTag[0], notFound: false };
    }
    if (exactTag.length > 1) {
      return { matches: exactTag, isAmbiguous: true, resolved: null, notFound: false };
    }
  }

  // 2. Exact repository match
  const exactRepo = images.filter(
    (img) => img.repository.toLowerCase() === normalizedRepo
  );
  if (exactRepo.length === 1) {
    return { matches: exactRepo, isAmbiguous: false, resolved: exactRepo[0], notFound: false };
  }
  if (exactRepo.length > 1) {
    return { matches: exactRepo, isAmbiguous: false, resolved: exactRepo[0], notFound: false };
  }

  // 3. Exact ID or Digest match
  const cleanId = (digest || clean).toLowerCase().replace(/^sha256:/, '');
  const exactId = images.filter((img) => {
    const iid = img.id.toLowerCase().replace(/^sha256:/, '');
    return (
      iid === cleanId ||
      (cleanId.length >= 12 && iid.length >= 12 && (iid.startsWith(cleanId) || cleanId.startsWith(iid)))
    );
  });
  if (exactId.length === 1) {
    return { matches: exactId, isAmbiguous: false, resolved: exactId[0], notFound: false };
  }
  if (exactId.length > 1) {
    return { matches: exactId, isAmbiguous: true, resolved: null, notFound: false };
  }

  // 4. Prefix ID match
  const prefixMatches = images.filter((img) => {
    const iid = img.id.toLowerCase().replace(/^sha256:/, '');
    return iid.startsWith(cleanId) || (cleanId.length >= 6 && cleanId.startsWith(iid));
  });

  if (prefixMatches.length === 1) {
    return { matches: prefixMatches, isAmbiguous: false, resolved: prefixMatches[0], notFound: false };
  }
  if (prefixMatches.length > 1) {
    return { matches: prefixMatches, isAmbiguous: true, resolved: null, notFound: false };
  }

  return { matches: [], isAmbiguous: false, resolved: null, notFound: true };
}

/**
 * Checks if a specific resolved image is protected (family or in-use by protected containers).
 */
export function isImageProtected(
  image: DockerImageSummary,
  inventory?: DockerInventorySnapshot
): { protected: boolean; reason?: string } {
  // 1. Check repository against protected families
  if (isProtectedImageFamily(image.repository)) {
    return {
      protected: true,
      reason: `Image repository "${image.repository}" belongs to protected image family`,
    };
  }

  // 2. Check full ref repo:tag
  const fullRef = `${image.repository}:${image.tag}`;
  if (isProtectedImageFamily(fullRef)) {
    return {
      protected: true,
      reason: `Image "${fullRef}" belongs to protected image family`,
    };
  }

  // 3. Check if image is in use by any protected container
  for (const cName of image.inUseByContainers || []) {
    if (PROTECTED_CONTAINERS.has(cName.replace(/^\//, '').toLowerCase())) {
      return {
        protected: true,
        reason: `Image is in use by protected container "${cName}"`,
      };
    }
  }

  if (inventory?.containers) {
    for (const container of inventory.containers) {
      if (PROTECTED_CONTAINERS.has(container.name.replace(/^\//, '').toLowerCase())) {
        const cleanImgId = image.id.replace(/^sha256:/, '').toLowerCase();
        const containerImg = container.image.toLowerCase();
        const containerImgId = (container.imageId || '').replace(/^sha256:/, '').toLowerCase();

        if (
          containerImg === image.repository.toLowerCase() ||
          containerImg === fullRef.toLowerCase() ||
          (cleanImgId && containerImgId && (cleanImgId === containerImgId || cleanImgId.startsWith(containerImgId) || containerImgId.startsWith(cleanImgId))) ||
          (cleanImgId && containerImg.includes(cleanImgId))
        ) {
          return {
            protected: true,
            reason: `Image is locked by protected container "${container.name}"`,
          };
        }
      }
    }
  }

  return { protected: false };
}

/**
 * Evaluates whether a target resource is protected, either statically or through inventory resolution.
 */
export function isResourceProtected(
  type: 'container' | 'network' | 'volume' | 'image',
  nameOrId: string,
  inventory?: DockerInventorySnapshot
): boolean {
  const clean = (nameOrId || '').trim().replace(/^\//, '');
  if (!clean) return false;

  switch (type) {
    case 'container': {
      if (PROTECTED_CONTAINERS.has(clean.toLowerCase())) return true;
      if (inventory?.containers) {
        const res = resolveContainer(clean, inventory.containers);
        if (res.resolved && PROTECTED_CONTAINERS.has(res.resolved.name.replace(/^\//, '').toLowerCase())) {
          return true;
        }
      }
      return false;
    }
    case 'network': {
      if (PROTECTED_NETWORKS.has(clean.toLowerCase())) return true;
      if (inventory?.networks) {
        const res = resolveNetwork(clean, inventory.networks);
        if (res.resolved && PROTECTED_NETWORKS.has(res.resolved.name.toLowerCase())) {
          return true;
        }
      }
      return false;
    }
    case 'volume': {
      if (PROTECTED_VOLUMES.has(clean.toLowerCase())) return true;
      if (inventory?.volumes) {
        const found = inventory.volumes.find((v) => v.name.toLowerCase() === clean.toLowerCase() || v.name.toLowerCase().startsWith(clean.toLowerCase()));
        if (found && PROTECTED_VOLUMES.has(found.name.toLowerCase())) return true;
      }
      return false;
    }
    case 'image': {
      if (isProtectedImageFamily(clean)) return true;
      if (inventory?.images) {
        const res = resolveImage(clean, inventory.images);
        if (res.resolved && isImageProtected(res.resolved, inventory).protected) {
          return true;
        }
      }
      return false;
    }
    default:
      return false;
  }
}

/**
 * Asserts that a resource is not protected. Resolves against inventory where available.
 * Throws 403 if protected, 400 if ambiguous, and handles unresolvable uncertainty safely.
 */
export function assertResourceNotProtected(
  type: 'container' | 'network' | 'volume' | 'image',
  nameOrId: string,
  operation: string,
  inventory?: DockerInventorySnapshot
): void {
  const clean = (nameOrId || '').trim().replace(/^\//, '');

  if (!clean) {
    throw new AppError(`Missing ${type} identifier for operation "${operation}".`, 400);
  }

  // 1. Static fast check
  if (type === 'container') {
    for (const pc of PROTECTED_CONTAINERS) {
      if (clean.toLowerCase() === pc) {
        throw new AppError(
          `Operation "${operation}" rejected: "${clean}" is a protected system container and cannot be modified or deleted.`,
          403
        );
      }
    }
  }

  if (type === 'network') {
    for (const pn of PROTECTED_NETWORKS) {
      if (clean.toLowerCase() === pn) {
        throw new AppError(
          `Operation "${operation}" rejected: "${clean}" is a protected system network and cannot be modified or deleted.`,
          403
        );
      }
    }
  }

  if (type === 'volume') {
    for (const pv of PROTECTED_VOLUMES) {
      if (clean.toLowerCase() === pv) {
        throw new AppError(
          `Operation "${operation}" rejected: "${clean}" is a protected system volume and cannot be modified or deleted.`,
          403
        );
      }
    }
  }

  if (type === 'image' && isProtectedImageFamily(clean)) {
    throw new AppError(
      `Operation "${operation}" rejected: "${clean}" is a protected system image and cannot be modified or deleted.`,
      403
    );
  }

  // 2. Inventory resolution
  if (inventory) {
    if (type === 'container') {
      const res = resolveContainer(clean, inventory.containers || []);
      if (res.isAmbiguous) {
        throw new AppError(
          `Ambiguous container identifier: "${nameOrId}" matches multiple containers (${res.matches.map((m) => m.name).join(', ')}).`,
          400
        );
      }
      if (res.resolved) {
        if (PROTECTED_CONTAINERS.has(res.resolved.name.replace(/^\//, '').toLowerCase())) {
          throw new AppError(
            `Operation "${operation}" rejected: "${res.resolved.name}" is a protected system container and cannot be modified or deleted.`,
            403
          );
        }
      } else if (res.notFound) {
        for (const pc of PROTECTED_CONTAINERS) {
          if (pc.startsWith(clean.toLowerCase()) || clean.toLowerCase().startsWith(pc)) {
            throw new AppError(
              `Operation "${operation}" rejected: "${nameOrId}" is a protected system container and cannot be modified or deleted.`,
              403
            );
          }
        }
        throw new AppError(`Target container "${nameOrId}" cannot be resolved reliably in Docker inventory.`, 404);
      }
    } else if (type === 'network') {
      const res = resolveNetwork(clean, inventory.networks || []);
      if (res.isAmbiguous) {
        throw new AppError(
          `Ambiguous network identifier: "${nameOrId}" matches multiple networks.`,
          400
        );
      }
      if (res.resolved) {
        if (PROTECTED_NETWORKS.has(res.resolved.name.toLowerCase())) {
          throw new AppError(
            `Operation "${operation}" rejected: "${res.resolved.name}" is a protected system network and cannot be modified or deleted.`,
            403
          );
        }
      } else if (res.notFound) {
        for (const pn of PROTECTED_NETWORKS) {
          if (pn.startsWith(clean.toLowerCase()) || clean.toLowerCase().startsWith(pn)) {
            throw new AppError(
              `Operation "${operation}" rejected: "${nameOrId}" is a protected system network and cannot be modified or deleted.`,
              403
            );
          }
        }
        throw new AppError(`Target network "${nameOrId}" cannot be resolved reliably in Docker inventory.`, 404);
      }
    } else if (type === 'volume') {
      if (PROTECTED_VOLUMES.has(clean.toLowerCase())) {
        throw new AppError(
          `Operation "${operation}" rejected: "${clean}" is a protected system volume and cannot be modified or deleted.`,
          403
        );
      }
      if (inventory.volumes) {
        const found = inventory.volumes.find((v) => v.name.toLowerCase() === clean.toLowerCase() || v.name.toLowerCase().startsWith(clean.toLowerCase()));
        if (found && PROTECTED_VOLUMES.has(found.name.toLowerCase())) {
          throw new AppError(
            `Operation "${operation}" rejected: "${found.name}" is a protected system volume and cannot be modified or deleted.`,
            403
          );
        }
        if (!found) {
          for (const pv of PROTECTED_VOLUMES) {
            if (pv.startsWith(clean.toLowerCase()) || clean.toLowerCase().startsWith(pv)) {
              throw new AppError(
                `Operation "${operation}" rejected: "${nameOrId}" is a protected system volume and cannot be modified or deleted.`,
                403
              );
            }
          }
          throw new AppError(`Target volume "${nameOrId}" cannot be resolved reliably in Docker inventory.`, 404);
        }
      }
    } else if (type === 'image') {
      const res = resolveImage(clean, inventory.images || []);
      if (res.isAmbiguous) {
        throw new AppError(
          `Ambiguous image identifier: "${nameOrId}" matches multiple images.`,
          400
        );
      }
      if (res.resolved) {
        const protCheck = isImageProtected(res.resolved, inventory);
        if (protCheck.protected) {
          throw new AppError(
            `Operation "${operation}" rejected: "${res.resolved.repository}:${res.resolved.tag}" is a protected system image and cannot be modified or deleted.`,
            403
          );
        }
      } else if (res.notFound) {
        if (isProtectedImageFamily(clean)) {
          throw new AppError(
            `Operation "${operation}" rejected: "${clean}" is a protected system image and cannot be modified or deleted.`,
            403
          );
        }
        throw new AppError(`Target image "${nameOrId}" cannot be resolved reliably in Docker inventory.`, 404);
      }
    }
  }
}

/**
 * Verifies both network and container are not protected for network disconnect.
 */
export function assertNetworkDisconnectNotProtected(
  networkIdOrName: string,
  containerId: string,
  operation: string,
  inventory?: DockerInventorySnapshot
): void {
  // 1. Verify network
  assertResourceNotProtected('network', networkIdOrName, operation, inventory);

  // 2. Verify container
  assertResourceNotProtected('container', containerId, operation, inventory);
}

/**
 * Asserts that dangling image prune will not affect any protected containers or image layers.
 */
export function assertImagePruneNotProtected(
  operation: string,
  inventory?: DockerInventorySnapshot
): void {
  if (!inventory) return;

  const danglingImages = (inventory.images || []).filter((img) => img.isDangling);

  for (const dImg of danglingImages) {
    const protCheck = isImageProtected(dImg, inventory);
    if (protCheck.protected) {
      throw new AppError(
        `Operation "${operation}" rejected: dangling image prune would affect protected resource (${protCheck.reason}).`,
        403
      );
    }
  }
}

export function recordAuditEvent(event: Omit<DockerAuditEvent, 'id' | 'timestamp'>): DockerAuditEvent {
  const fullEvent: DockerAuditEvent = {
    id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    timestamp: new Date().toISOString(),
    ...event,
  };

  auditLogStore.unshift(fullEvent);
  if (auditLogStore.length > MAX_AUDIT_LOGS) {
    auditLogStore.pop();
  }

  return fullEvent;
}

export function getAuditEvents(limit = 100): DockerAuditEvent[] {
  return auditLogStore.slice(0, Math.min(limit, 500));
}
