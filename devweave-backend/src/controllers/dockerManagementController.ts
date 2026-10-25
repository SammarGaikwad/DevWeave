import type { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/authenticate.js';
import { AppError } from '../middleware/errorHandler.js';
import {
  getInventorySnapshot,
  executeManagementAction,
} from '../services/dockerManagementService.js';
import { getAuditEvents } from '../services/dockerProtectionService.js';
import {
  containerCreateSchema,
  containerRecreateSchema,
  containerStopSchema,
  containerDeleteSchema,
  containerLogsQuerySchema,
  imageTagSchema,
  imageDeleteSchema,
  networkCreateSchema,
  networkConnectionSchema,
  volumeCreateSchema,
  volumeDeleteSchema,
} from '../schemas/dockerManagementSchema.js';

export function getDockerInventory(
  _req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  try {
    const inventory = getInventorySnapshot();
    res.status(200).json({
      success: true,
      data: inventory,
    });
  } catch (error) {
    next(error);
  }
}

export function getDockerAuditLogs(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 100;
    const events = getAuditEvents(limit);
    res.status(200).json({
      success: true,
      data: events,
    });
  } catch (error) {
    next(error);
  }
}

// ----------------- Container Operations -----------------

export async function startContainer(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const result = await executeManagementAction(
      'CONTAINER_START',
      { containerId: id },
      { id: req.user!.id }
    );
    res.status(200).json({ success: true, message: `Container "${id}" started successfully.`, data: result });
  } catch (error) {
    next(error);
  }
}

export async function stopContainer(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const parsed = containerStopSchema.safeParse({ containerId: id, ...req.body });
    if (!parsed.success) {
      throw new AppError('Invalid stop container parameters.', 400);
    }

    const result = await executeManagementAction(
      'CONTAINER_STOP',
      parsed.data,
      { id: req.user!.id }
    );
    res.status(200).json({ success: true, message: `Container "${id}" stopped gracefully.`, data: result });
  } catch (error) {
    next(error);
  }
}

export async function restartContainer(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const result = await executeManagementAction(
      'CONTAINER_RESTART',
      { containerId: id, timeout: req.body?.timeout || 10 },
      { id: req.user!.id }
    );
    res.status(200).json({ success: true, message: `Container "${id}" restarted successfully.`, data: result });
  } catch (error) {
    next(error);
  }
}

export async function deleteContainer(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const parsed = containerDeleteSchema.safeParse({ containerId: id, ...req.body });
    if (!parsed.success) {
      throw new AppError('Invalid delete container parameters.', 400);
    }

    const result = await executeManagementAction(
      'CONTAINER_DELETE',
      parsed.data,
      { id: req.user!.id }
    );
    res.status(200).json({ success: true, message: `Container "${id}" deleted successfully.`, data: result });
  } catch (error) {
    next(error);
  }
}

export async function getContainerLogs(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const query = containerLogsQuerySchema.parse(req.query);

    const result = await executeManagementAction(
      'CONTAINER_LOGS',
      { containerId: id, tail: query.tail, timestamps: query.timestamps },
      { id: req.user!.id }
    );
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

export async function inspectContainer(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const result = await executeManagementAction(
      'CONTAINER_INSPECT',
      { containerId: id },
      { id: req.user!.id }
    );
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

export async function createContainer(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const parsed = containerCreateSchema.parse(req.body);
    const result = await executeManagementAction(
      'CONTAINER_CREATE',
      parsed,
      { id: req.user!.id }
    );
    res.status(201).json({ success: true, message: `Container "${parsed.name}" created successfully.`, data: result });
  } catch (error) {
    next(error);
  }
}

export async function recreateContainer(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const parsed = containerRecreateSchema.parse({ containerId: id, ...req.body });

    const result = await executeManagementAction(
      'CONTAINER_RECREATE',
      parsed,
      { id: req.user!.id }
    );
    res.status(200).json({ success: true, message: `Container recreated successfully.`, data: result });
  } catch (error) {
    next(error);
  }
}

// ----------------- Image Operations -----------------

export async function tagImage(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const parsed = imageTagSchema.parse(req.body);
    const result = await executeManagementAction(
      'IMAGE_TAG',
      parsed,
      { id: req.user!.id }
    );
    res.status(200).json({ success: true, message: `Image tagged as "${parsed.targetTag}".`, data: result });
  } catch (error) {
    next(error);
  }
}

export async function deleteImage(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const parsed = imageDeleteSchema.parse({ imageIdOrTag: req.params.id || req.body?.imageIdOrTag });
    const result = await executeManagementAction(
      'IMAGE_DELETE',
      parsed,
      { id: req.user!.id }
    );
    res.status(200).json({ success: true, message: `Image deleted successfully.`, data: result });
  } catch (error) {
    next(error);
  }
}

export async function pruneDanglingImages(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const result = await executeManagementAction(
      'IMAGE_PRUNE_DANGLING',
      {},
      { id: req.user!.id }
    );
    res.status(200).json({ success: true, message: 'Dangling images pruned safely.', data: result });
  } catch (error) {
    next(error);
  }
}

// ----------------- Network Operations -----------------

export async function createNetwork(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const parsed = networkCreateSchema.parse(req.body);
    const result = await executeManagementAction(
      'NETWORK_CREATE',
      parsed,
      { id: req.user!.id }
    );
    res.status(201).json({ success: true, message: `Network "${parsed.name}" created.`, data: result });
  } catch (error) {
    next(error);
  }
}

export async function deleteNetwork(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const result = await executeManagementAction(
      'NETWORK_DELETE',
      { networkIdOrName: id },
      { id: req.user!.id }
    );
    res.status(200).json({ success: true, message: `Network "${id}" deleted.`, data: result });
  } catch (error) {
    next(error);
  }
}

export async function connectNetwork(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const parsed = networkConnectionSchema.parse(req.body);
    const result = await executeManagementAction(
      'NETWORK_CONNECT',
      parsed,
      { id: req.user!.id }
    );
    res.status(200).json({ success: true, message: `Container connected to network.`, data: result });
  } catch (error) {
    next(error);
  }
}

export async function disconnectNetwork(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const parsed = networkConnectionSchema.parse(req.body);
    const result = await executeManagementAction(
      'NETWORK_DISCONNECT',
      parsed,
      { id: req.user!.id }
    );
    res.status(200).json({ success: true, message: `Container disconnected from network.`, data: result });
  } catch (error) {
    next(error);
  }
}

// ----------------- Volume Operations -----------------

export async function createVolume(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const parsed = volumeCreateSchema.parse(req.body);
    const result = await executeManagementAction(
      'VOLUME_CREATE',
      parsed,
      { id: req.user!.id }
    );
    res.status(201).json({ success: true, message: `Volume "${parsed.name}" created.`, data: result });
  } catch (error) {
    next(error);
  }
}

export async function deleteVolume(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { name } = req.params;
    const parsed = volumeDeleteSchema.parse({ volumeName: name });
    const result = await executeManagementAction(
      'VOLUME_DELETE',
      parsed,
      { id: req.user!.id }
    );
    res.status(200).json({ success: true, message: `Volume "${name}" deleted.`, data: result });
  } catch (error) {
    next(error);
  }
}
