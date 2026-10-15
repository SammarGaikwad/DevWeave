import { Request, Response, NextFunction } from 'express';
import {
  getSystemMonitoringSnapshot,
  getCentralizedLogs,
} from '../services/monitoringService.js';

export async function getSystemHealthSnapshot(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const snapshot = await getSystemMonitoringSnapshot();
    res.status(200).json({
      success: true,
      data: snapshot,
    });
  } catch (error) {
    next(error);
  }
}

export async function getPlatformLogs(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const logs = await getCentralizedLogs();
    res.status(200).json({
      success: true,
      data: logs,
    });
  } catch (error) {
    next(error);
  }
}
