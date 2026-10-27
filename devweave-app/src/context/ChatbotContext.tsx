import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  aiService,
  type AIProviderStatus,
  type AIChatMessage,
  type DiagnosticResult,
} from '../services/aiService';

export interface ChatItem {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  isAIGenerated?: boolean;
  engineType?: string;
  provider?: string;
  diagnosis?: DiagnosticResult;
  suggestedActions?: { label: string; action: string }[];
  isError?: boolean;
}

interface ChatbotContextType {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  toggleChat: () => void;
  messages: ChatItem[];
  isLoading: boolean;
  error: string | null;
  providerStatus: AIProviderStatus | null;
  sendMessage: (content: string) => Promise<void>;
  clearMessages: () => void;
  retryLastMessage: () => Promise<void>;
}

const ChatbotContext = createContext<ChatbotContextType | undefined>(undefined);

const INITIAL_WELCOME: ChatItem = {
  id: 'welcome-msg',
  role: 'assistant',
  content: `Hello! I'm your **DevWeave AI Assistant**.

I can help diagnose build failures, guide Kubernetes and Docker operations, and troubleshoot deployment issues. How can I assist you today?`,
  timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  isAIGenerated: false,
  engineType: 'RULE_BASED_DIAGNOSTIC_ENGINE',
  provider: 'DETERMINISTIC_RULES',
  suggestedActions: [
    { label: '⚡ Diagnose Pipeline Failure', action: 'Why did my build fail with vitest: not found?' },
    { label: '☸️ Deploy Kubernetes Service', action: 'How do I create and expose a Kubernetes Service?' },
    { label: '🐳 Troubleshoot Docker Runner', action: 'Troubleshoot Docker daemon offline connection' },
    { label: '🔍 TypeScript Compiler Error', action: 'Diagnose TypeScript compiler error TS2322' },
  ],
};

const STORAGE_KEY = 'devweave_ai_chat_session_v1';

export const ChatbotProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOpen, setIsOpen] = useState<boolean>(() => {
    try {
      const saved = sessionStorage.getItem(`${STORAGE_KEY}_open`);
      return saved === 'true';
    } catch {
      return false;
    }
  });

  const [messages, setMessages] = useState<ChatItem[]>(() => {
    try {
      const saved = sessionStorage.getItem(`${STORAGE_KEY}_messages`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {
      // ignore
    }
    return [INITIAL_WELCOME];
  });

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [providerStatus, setProviderStatus] = useState<AIProviderStatus | null>(null);

  // Sync open state to session storage
  useEffect(() => {
    try {
      sessionStorage.setItem(`${STORAGE_KEY}_open`, String(isOpen));
    } catch {
      // ignore
    }
  }, [isOpen]);

  // Sync messages to session storage
  useEffect(() => {
    try {
      sessionStorage.setItem(`${STORAGE_KEY}_messages`, JSON.stringify(messages));
    } catch {
      // ignore
    }
  }, [messages]);

  // Fetch AI provider status once
  useEffect(() => {
    let mounted = true;
    aiService
      .getStatus()
      .then((status) => {
        if (mounted) setProviderStatus(status);
      })
      .catch(() => {
        if (mounted) {
          setProviderStatus({
            provider: 'DETERMINISTIC_RULES',
            modelName: 'DevWeave Static Diagnostic Engine v1.0',
            isLLMConfigured: false,
            attributionNotice:
              'Running on built-in deterministic heuristic rule engine. No external LLM API key is configured.',
            supportedSignatures: [
              'Vitest devDependencies CI omission',
              'TypeScript compiler errors',
              'Network connection timeouts',
              'Docker daemon offline socket errors',
            ],
          });
        }
      });
    return () => {
      mounted = false;
    };
  }, []);

  const toggleChat = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isLoading) return;

      setError(null);
      const userMessageId = `user-${Date.now()}`;
      const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      const newMsg: ChatItem = {
        id: userMessageId,
        role: 'user',
        content: trimmed,
        timestamp: nowStr,
      };

      setMessages((prev) => [...prev, newMsg]);
      setIsLoading(true);

      try {
        const historyForApi: AIChatMessage[] = messages
          .filter((m) => !m.isError)
          .slice(-6)
          .map((m) => ({ role: m.role, content: m.content }));

        const response = await aiService.chat(trimmed, historyForApi);

        const assistantMsg: ChatItem = {
          id: `ai-${Date.now()}`,
          role: 'assistant',
          content: response.message,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isAIGenerated: response.isAIGenerated,
          engineType: response.engineType,
          provider: response.provider,
          diagnosis: response.diagnosis,
          suggestedActions: response.suggestedActions,
        };

        setMessages((prev) => [...prev, assistantMsg]);
      } catch (err: any) {
        const errorMsg =
          err?.response?.data?.message ||
          err?.message ||
          'Failed to connect to the AI assistant. Please check your connection.';
        setError(errorMsg);

        const errorItem: ChatItem = {
          id: `err-${Date.now()}`,
          role: 'assistant',
          content: `⚠️ **Error:** ${errorMsg}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isError: true,
        };

        setMessages((prev) => [...prev, errorItem]);
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, messages]
  );

  const retryLastMessage = useCallback(async () => {
    const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user');
    if (lastUserMsg) {
      // Remove any trailing error message
      setMessages((prev) => {
        const filtered = prev.filter((m) => !m.isError);
        return filtered;
      });
      await sendMessage(lastUserMsg.content);
    }
  }, [messages, sendMessage]);

  const clearMessages = useCallback(() => {
    setMessages([INITIAL_WELCOME]);
    setError(null);
    try {
      sessionStorage.removeItem(`${STORAGE_KEY}_messages`);
    } catch {
      // ignore
    }
  }, []);

  return (
    <ChatbotContext.Provider
      value={{
        isOpen,
        setIsOpen,
        toggleChat,
        messages,
        isLoading,
        error,
        providerStatus,
        sendMessage,
        clearMessages,
        retryLastMessage,
      }}
    >
      {children}
    </ChatbotContext.Provider>
  );
};

export const useChatbot = (): ChatbotContextType => {
  const context = useContext(ChatbotContext);
  if (!context) {
    throw new Error('useChatbot must be used within a ChatbotProvider');
  }
  return context;
};
