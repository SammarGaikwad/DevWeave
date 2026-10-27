import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  Bot,
  Send,
  X,
  Trash2,
  Copy,
  Check,
  RotateCcw,
  AlertCircle,
  Terminal,
  ShieldCheck,
  Info,
  Square,
} from 'lucide-react';
import { useChatbot, type ChatItem } from '../../context/ChatbotContext';
import { SUGGESTED_PROMPTS } from '../../services/aiService';

export const FloatingChatbot: React.FC = () => {
  const {
    isOpen,
    toggleChat,
    setIsOpen,
    messages,
    isLoading,
    error,
    providerStatus,
    sendMessage,
    stopGeneration,
    clearMessages,
    retryLastMessage,
  } = useChatbot();

  const [input, setInput] = useState<string>('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, isLoading]);

  // Focus textarea when panel opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen]);

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;
    setInput('');
    await sendMessage(trimmed);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Helper to format basic markdown-style responses (bold, code blocks, lists)
  const renderMessageContent = (item: ChatItem) => {
    const content = item.content;

    // Check if message has code blocks
    const parts = content.split(/(```[\s\S]*?```)/g);

    return (
      <div className="space-y-2 text-xs leading-relaxed">
        {parts.map((part, index) => {
          if (part.startsWith('```') && part.endsWith('```')) {
            const lines = part.slice(3, -3).trim().split('\n');
            const language = lines[0].match(/^[a-z0-9_-]+/i) ? lines[0] : '';
            const code = language ? lines.slice(1).join('\n') : lines.join('\n');
            const codeSnippetId = `${item.id}-code-${index}`;

            return (
              <div
                key={index}
                className="my-2 rounded-xl bg-slate-950 border border-slate-800 overflow-hidden font-mono text-[11px]"
              >
                <div className="flex items-center justify-between px-3 py-1.5 bg-slate-900/80 border-b border-slate-800 text-slate-400 text-[10px]">
                  <span className="flex items-center space-x-1.5">
                    <Terminal className="w-3 h-3 text-indigo-400" />
                    <span>{language || 'snippet'}</span>
                  </span>
                  <button
                    onClick={() => handleCopy(code, codeSnippetId)}
                    className="p-1 hover:text-slate-200 transition flex items-center space-x-1"
                    title="Copy command"
                  >
                    {copiedId === codeSnippetId ? (
                      <Check className="w-3 h-3 text-emerald-400" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                    <span>{copiedId === codeSnippetId ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
                <pre className="p-3 overflow-x-auto text-slate-200 whitespace-pre-wrap">{code}</pre>
              </div>
            );
          }

          // Format paragraphs with bold and lists
          const paragraphs = part.split('\n\n');
          return (
            <div key={index} className="space-y-1.5">
              {paragraphs.map((p, pIdx) => {
                const trimmedP = p.trim();
                if (!trimmedP) return null;

                // Headers
                if (trimmedP.startsWith('### ')) {
                  return (
                    <div key={pIdx} className="font-semibold text-slate-100 text-sm pt-1">
                      {trimmedP.replace('### ', '')}
                    </div>
                  );
                }

                // Regular lines with simple formatting
                return (
                  <p key={pIdx} className="whitespace-pre-wrap">
                    {trimmedP.split(/(\*\*.*?\*\*|`.*?`)/g).map((chunk, cIdx) => {
                      if (chunk.startsWith('**') && chunk.endsWith('**')) {
                        return (
                          <strong key={cIdx} className="font-semibold text-slate-100">
                            {chunk.slice(2, -2)}
                          </strong>
                        );
                      }
                      if (chunk.startsWith('`') && chunk.endsWith('`')) {
                        return (
                          <code
                            key={cIdx}
                            className="px-1.5 py-0.5 rounded bg-slate-800 text-indigo-300 font-mono text-[11px]"
                          >
                            {chunk.slice(1, -1)}
                          </code>
                        );
                      }
                      return chunk;
                    })}
                  </p>
                );
              })}
            </div>
          );
        })}

        {/* Diagnosis Card if available */}
        {item.diagnosis && (
          <div className="mt-3 p-3 rounded-xl bg-slate-950/70 border border-indigo-500/30 space-y-2">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-mono text-indigo-400 font-semibold">{item.diagnosis.signature}</span>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                  item.diagnosis.severity === 'CRITICAL'
                    ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                    : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                }`}
              >
                {item.diagnosis.severity}
              </span>
            </div>
            <div className="text-[11px] text-slate-300">{item.diagnosis.rootCause}</div>
          </div>
        )}

        {/* Quick action chips if available */}
        {item.suggestedActions && item.suggestedActions.length > 0 && (
          <div className="pt-2 flex flex-wrap gap-1.5">
            {item.suggestedActions.map((action, aIdx) => (
              <button
                key={aIdx}
                onClick={() => sendMessage(action.action)}
                className="px-2.5 py-1 text-[11px] bg-slate-800/80 hover:bg-indigo-600/30 text-indigo-300 hover:text-indigo-200 border border-slate-700 hover:border-indigo-500/40 rounded-lg transition text-left"
              >
                {action.label}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      {/* 1. Floating Circular Trigger Button */}
      <div className="fixed bottom-5 right-5 sm:bottom-6 sm:right-6 z-50">
        <button
          onClick={toggleChat}
          aria-label="Toggle DevWeave AI Assistant"
          title="DevWeave AI Assistant"
          className="group relative w-12 h-12 sm:w-13 sm:h-13 rounded-full bg-gradient-to-tr from-indigo-600 via-indigo-500 to-blue-500 hover:from-indigo-500 hover:to-blue-400 text-white shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 border border-indigo-400/40 flex items-center justify-center transition-all duration-300 hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-indigo-400"
        >
          {isOpen ? (
            <X className="w-5 h-5 sm:w-6 sm:h-6 transition-transform group-hover:rotate-90 duration-200" />
          ) : (
            <>
              <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 transition-transform group-hover:scale-110 duration-200 animate-pulse" />
              {/* Active online beacon */}
              <span className="absolute top-0 right-0 w-3 h-3 rounded-full bg-emerald-400 border-2 border-[#050505]" />
            </>
          )}

          {/* Accessible hover tooltip (visible when closed) */}
          {!isOpen && (
            <span className="absolute right-full mr-3 px-2.5 py-1 text-xs font-medium text-slate-200 bg-slate-900 border border-slate-800 rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
              DevWeave AI Assistant
            </span>
          )}
        </button>
      </div>

      {/* 2. Floating Chat Panel */}
      {isOpen && (
        <div
          role="dialog"
          aria-label="DevWeave AI Chatbot"
          className="fixed bottom-20 right-3 left-3 sm:left-auto sm:right-6 z-50 sm:w-[420px] max-w-[calc(100vw-24px)] h-[560px] max-h-[calc(100vh-100px)] bg-[#090a10]/95 backdrop-blur-xl border border-slate-800/90 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200"
        >
          {/* Header */}
          <div className="px-4 py-3 bg-slate-900/90 border-b border-slate-800/90 flex items-center justify-between shrink-0">
            <div className="flex items-center space-x-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-blue-500 flex items-center justify-center text-white shrink-0 shadow-md shadow-indigo-600/30">
                <Bot className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center space-x-1.5">
                  <span className="font-semibold text-slate-100 text-xs sm:text-sm truncate">
                    DevWeave AI
                  </span>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" title="Operational" />
                </div>
                <div className="text-[10px] text-slate-400 flex items-center space-x-1 truncate">
                  <ShieldCheck className="w-3 h-3 text-indigo-400 shrink-0" />
                  <span className="truncate">
                    {providerStatus?.isLLMConfigured
                      ? `${providerStatus.provider} (${providerStatus.modelName})`
                      : 'Rule-Based Diagnostic Engine'}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-1 shrink-0">
              <button
                onClick={clearMessages}
                title="Clear conversation"
                className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                title="Minimize assistant"
                className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Engine notice banner */}
          <div className="px-3 py-1.5 bg-indigo-950/20 border-b border-indigo-900/20 flex items-center justify-between text-[11px] text-indigo-300/80">
            <span className="flex items-center space-x-1.5 truncate">
              <Info className="w-3 h-3 text-indigo-400 shrink-0" />
              <span className="truncate">
                {providerStatus?.isLLMConfigured
                  ? 'External LLM connected'
                  : 'Deterministic engine • No external data sent'}
              </span>
            </span>
          </div>

          {/* Message List */}
          <div className="flex-1 p-3.5 sm:p-4 overflow-y-auto space-y-3.5">
            {messages.map((item) => {
              const isUser = item.role === 'user';
              return (
                <div
                  key={item.id}
                  className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 ${
                      isUser
                        ? 'bg-indigo-600 text-white rounded-tr-sm shadow-md shadow-indigo-900/20'
                        : item.isError
                        ? 'bg-rose-950/40 text-rose-200 border border-rose-800/40 rounded-tl-sm'
                        : 'bg-slate-900/90 text-slate-100 border border-slate-800/90 rounded-tl-sm shadow-sm'
                    }`}
                  >
                    {renderMessageContent(item)}
                  </div>
                  <span className="text-[10px] text-slate-500 mt-1 px-1">{item.timestamp}</span>
                </div>
              );
            })}

            {/* Typing / Loading indicator */}
            {isLoading && (
              <div className="flex flex-col items-start space-y-1.5">
                <div className="rounded-2xl rounded-tl-sm px-4 py-3 bg-slate-900/90 border border-slate-800/90 flex items-center space-x-2 text-indigo-400 text-xs">
                  <Sparkles className="w-3.5 h-3.5 animate-spin" />
                  <span className="text-slate-300">Analyzing query...</span>
                  <div className="flex space-x-1 pl-1">
                    <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                    <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                    <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" />
                  </div>
                </div>
                <button
                  onClick={stopGeneration}
                  className="px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/20 text-[11px] font-medium transition flex items-center space-x-1"
                >
                  <Square className="w-2.5 h-2.5 fill-rose-300" />
                  <span>Stop generating</span>
                </button>
              </div>
            )}

            {/* Error retry banner */}
            {error && !isLoading && (
              <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-between text-xs text-rose-300">
                <div className="flex items-center space-x-2 truncate">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span className="truncate">{error}</span>
                </div>
                <button
                  onClick={retryLastMessage}
                  className="px-2 py-1 text-[11px] font-medium bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 rounded-lg transition flex items-center space-x-1 shrink-0 ml-2"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Retry</span>
                </button>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick Prompts when only welcome message exists */}
          {messages.length === 1 && (
            <div className="px-3 pb-2 flex items-center space-x-1.5 overflow-x-auto text-[11px] shrink-0 scrollbar-none">
              {SUGGESTED_PROMPTS.slice(0, 4).map((prompt, idx) => (
                <button
                  key={idx}
                  onClick={() => sendMessage(prompt)}
                  className="px-2.5 py-1 rounded-lg bg-slate-900/80 hover:bg-indigo-600/20 text-slate-300 hover:text-indigo-300 border border-slate-800 transition whitespace-nowrap"
                >
                  {prompt}
                </button>
              ))}
            </div>
          )}

          {/* Input Area */}
          <div className="p-3 bg-slate-900/80 border-t border-slate-800 shrink-0">
            <div className="relative flex items-center">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask DevWeave AI or paste logs/errors..."
                rows={1}
                className="w-full pl-3 pr-10 py-2.5 text-xs bg-slate-950 border border-slate-700/80 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition resize-none max-h-24"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                aria-label="Send message"
                className="absolute right-1.5 p-2 text-indigo-400 hover:text-indigo-300 disabled:text-slate-600 hover:bg-indigo-500/10 disabled:bg-transparent rounded-lg transition"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
            <div className="mt-1.5 flex items-center justify-between text-[10px] text-slate-500">
              <span>Press Enter to send, Shift+Enter for newline</span>
              <span>DevOps AI Assistant</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
