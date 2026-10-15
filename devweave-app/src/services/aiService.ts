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
};
