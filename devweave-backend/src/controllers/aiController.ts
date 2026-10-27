import { Request, Response, NextFunction } from 'express';
import { diagnoseBuildLog } from '../services/diagnosticService.js';
import { processChatMessage, type ChatMessage } from '../services/aiChatService.js';
import { env } from '../config/env.js';
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

const aiChatSchema = z.object({
  message: z
    .string()
    .trim()
    .min(1, 'Message is required and cannot be empty.')
    .max(4000, 'Message cannot exceed 4000 characters.'),
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant', 'system']),
        content: z.string().max(4000),
      })
    )
    .optional()
    .default([]),
});

export function getDiagnosticProviderStatus(
  _req: Request,
  res: Response
): void {
  const hasOpenAI = Boolean(env.OPENAI_API_KEY);
  const hasGemini = Boolean(env.GEMINI_API_KEY);
  const isLLMConfigured = hasOpenAI || hasGemini;
  const provider = hasOpenAI ? 'OPENAI' : hasGemini ? 'GEMINI' : 'DETERMINISTIC_RULES';
  const modelName = hasOpenAI
    ? env.OPENAI_MODEL
    : hasGemini
    ? env.GEMINI_MODEL
    : 'DevWeave Static Diagnostic Engine v1.0';

  res.status(200).json({
    success: true,
    data: {
      provider,
      modelName,
      isLLMConfigured,
      attributionNotice: isLLMConfigured
        ? `Connected to external LLM provider ${provider} (${modelName}).`
        : 'Running on built-in deterministic heuristic rule engine. No external LLM API key (OpenAI/Gemini/Anthropic) is configured or exposed.',
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

export async function chatWithAI(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const parsed = aiChatSchema.parse(req.body);
    const result = await processChatMessage(parsed.message, parsed.history as ChatMessage[]);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}
