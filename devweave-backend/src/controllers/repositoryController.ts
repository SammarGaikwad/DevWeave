import { Request, Response, NextFunction } from 'express';
import * as repositoryService from '../services/repositoryService.js';

export async function getRepositories(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const repositories = await repositoryService.listRepositories();
    res.status(200).json({
      success: true,
      data: repositories,
    });
  } catch (error) {
    next(error);
  }
}

export async function getRepositoryById(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const repository = await repositoryService.getRepositoryById(id);
    res.status(200).json({
      success: true,
      data: repository,
    });
  } catch (error) {
    next(error);
  }
}
