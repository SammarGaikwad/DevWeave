import React from 'react';
import { Check, Sparkles, Code2 } from 'lucide-react';
import { TypingIndicator } from './TypingIndicator';

export interface ChatBubbleProps {
  sender: 'developer' | 'ai';
  message?: string;
  analysisSteps?: string[];
  visibleStepsCount?: number;
  isAnalyzing?: boolean;
  showAnswer?: boolean;
}

export const ChatBubble: React.FC<ChatBubbleProps> = ({
  sender,
  message,
  analysisSteps = [],
  visibleStepsCount = 0,
  isAnalyzing = false,
  showAnswer = false,
}) => {
  if (sender === 'developer') {
    return (
      <div className="flex items-start gap-4 mb-6 animate-fadeIn">
        {/* Developer Dark Avatar */}
        <div className="w-10 h-10 rounded-full bg-white/10 border border-white/15 flex items-center justify-center text-white/80 font-mono text-sm font-semibold shrink-0 shadow-md">
          <Code2 className="w-5 h-5 text-white/90" />
        </div>

        {/* Developer Message Bubble */}
        <div className="liquid-glass rounded-2xl rounded-tl-sm px-5 py-3.5 border border-white/10 max-w-xl text-white text-sm md:text-base leading-relaxed font-medium shadow-lg">
          {message}
        </div>
      </div>
    );
  }

  // DevWeave AI Sender Bubble
  return (
    <div className="flex items-start gap-4 mb-6 animate-fadeIn">
      {/* DevWeave AI Glowing Avatar */}
      <div className="relative shrink-0">
        <div className="absolute inset-0 rounded-full bg-cyan-400/40 blur-md animate-pulse" />
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-600 to-cyan-500 border border-cyan-400/50 flex items-center justify-center text-white font-bold text-xs tracking-wider relative z-10 shadow-[0_0_15px_rgba(56,189,248,0.5)]">
          DW
        </div>
      </div>

      {/* AI Message Content Area */}
      <div className="flex-1 max-w-3xl">
        <div className="liquid-glass rounded-2xl rounded-tl-sm p-6 border border-cyan-500/20 shadow-2xl space-y-5">
          
          {/* Analysis Header */}
          <div className="flex items-center gap-2 text-cyan-400 text-xs font-semibold uppercase tracking-wider">
            <Sparkles className="w-4 h-4 animate-spin [animation-duration:6s]" />
            <span>Analyzing infrastructure & pipeline state...</span>
          </div>

          {/* Progressive Checkmark Analysis Steps */}
          {analysisSteps.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 pt-1">
              {analysisSteps.map((step, idx) => {
                const isComplete = idx < visibleStepsCount;
                return (
                  <div
                    key={step}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-all duration-500 ${
                      isComplete
                        ? 'liquid-glass border-emerald-500/30 text-white bg-emerald-500/5 shadow-[0_0_10px_rgba(52,211,153,0.15)]'
                        : 'border border-white/5 text-white/30 bg-white/[0.01]'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-full flex items-center justify-center transition-all duration-500 ${
                        isComplete
                          ? 'bg-emerald-400 text-black scale-100 shadow-[0_0_8px_rgba(52,211,153,0.8)]'
                          : 'bg-white/10 text-transparent scale-75'
                      }`}
                    >
                      <Check className="w-3 h-3 stroke-[3]" />
                    </div>
                    <span>{step}</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Typing Indicator while steps/answer are processing */}
          {isAnalyzing && visibleStepsCount < analysisSteps.length && (
            <div className="pt-2">
              <TypingIndicator />
            </div>
          )}

          {/* Final Answer Block */}
          {showAnswer && (
            <div className="pt-4 border-t border-white/10 space-y-4 animate-fadeIn">
              
              {/* Failure Explanation */}
              <div>
                <h4 className="text-sm font-semibold text-white/90 mb-2">
                  Deployment failed because:
                </h4>
                <ul className="space-y-1.5 text-xs md:text-sm text-white/75 pl-4 list-disc marker:text-rose-400">
                  <li>
                    Docker image version <code className="text-rose-300 bg-rose-950/40 px-1.5 py-0.5 rounded font-mono border border-rose-500/30">2.4.1</code> was not found.
                  </li>
                  <li>
                    Kubernetes deployment entered <code className="text-amber-300 bg-amber-950/40 px-1.5 py-0.5 rounded font-mono border border-amber-500/30">ImagePullBackOff</code>.
                  </li>
                  <li>
                    Jenkins successfully completed the build step.
                  </li>
                </ul>
              </div>

              {/* Recommended Fix */}
              <div className="p-4 rounded-2xl bg-cyan-950/20 border border-cyan-500/30">
                <h5 className="text-xs font-semibold text-cyan-300 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                  Recommended Fix:
                </h5>
                <p className="text-xs md:text-sm text-cyan-100 font-medium leading-relaxed">
                  Update the deployment image tag to version <code className="text-cyan-200 bg-cyan-900/60 px-1.5 py-0.5 rounded font-mono border border-cyan-400/40">2.4.2</code> and redeploy.
                </p>
              </div>

            </div>
          )}

        </div>
      </div>
    </div>
  );
};
