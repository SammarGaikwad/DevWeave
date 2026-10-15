import { Request, Response, NextFunction } from 'express';
import { diagnoseBuildLog } from '../services/diagnosticService.js';
import { z } from 'zod';

const diagnoseSchema = z.object({
  logText: z.string().min(1, 'Log text is required for diagnosis.'),
  context: z
    .object({
      pipelineId: z.string().optional(),
      runId: z.string().optional(),
      stageName: z.string().optional(),
    })
    .optional(),
});

export function getDiagnosticProviderStatus(
  _req: Request,
  res: Response
): void {
  // Truthfully report active engine
  res.status(200).json({
    success: true,
    data: {
      provider: 'DETERMINISTIC_RULES',
      modelName: 'DevWeave Static Diagnostic Engine v1.0',
      isLLMConfigured: false,
      attributionNotice:
        'Running on built-in deterministic heuristic rule engine. No external LLM API key (OpenAI/Gemini/Anthropic) is configured or exposed.',
      supportedSignatures: [
        'Vitest devDependencies CI omission',
        'TypeScript compiler errors (TSxxxx)',
        'Network connection timeouts & ECONNREFUSED',
        'Docker daemon offline socket errors',
        'Heap memory exhaustion (OOM)',
      ],
    },
  });
}

export function diagnosePipelineFailure(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  try {
    const parsed = diagnoseSchema.parse(req.body);
    const diagnosis = diagnoseBuildLog(parsed.logText);

    res.status(200).json({
      success: true,
      data: diagnosis,
    });
  } catch (error) {
    next(error);
  }
}
