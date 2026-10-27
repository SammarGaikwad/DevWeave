import { apiClient } from './apiClient';

export interface AIProviderStatus {
  provider: string;
  modelName: string;
  isLLMConfigured: boolean;
  attributionNotice: string;
  supportedSignatures: string[];
}

export interface DiagnosticResult {
  engineType: 'RULE_BASED_DIAGNOSTIC_ENGINE';
  isAIGenerated: false;
  signature: string;
  category: string;
  title: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  rootCause: string;
  pinpointedLogSnippet?: string;
  recommendedFixes: {
    title: string;
    description: string;
    command?: string;
    codeSnippet?: string;
  }[];
  preventionGuideline: string;
}

export interface AIChatMessage {
  id?: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: string;
}

export interface AIChatResponse {
  message: string;
  isAIGenerated: boolean;
  engineType: 'LLM_PROVIDER' | 'RULE_BASED_DIAGNOSTIC_ENGINE';
  provider: 'OPENAI' | 'GEMINI' | 'DETERMINISTIC_RULES';
  modelName: string;
  diagnosis?: DiagnosticResult;
  suggestedActions?: { label: string; action: string }[];
}

export const aiService = {
  async getStatus(): Promise<AIProviderStatus> {
    const res = await apiClient.get<{ success: boolean; data: AIProviderStatus }>('/v1/ai/status');
    return res.data;
  },

  async diagnoseLog(logText: string): Promise<DiagnosticResult> {
    const res = await apiClient.post<{ success: boolean; data: DiagnosticResult }>('/v1/ai/diagnose', {
      logText,
    });
    return res.data;
  },

  async chat(message: string, history?: AIChatMessage[]): Promise<AIChatResponse> {
    const res = await apiClient.post<{ success: boolean; data: AIChatResponse }>('/v1/ai/chat', {
      message,
      history: history?.map((h) => ({ role: h.role, content: h.content })),
    });
    return res.data;
  },
};
