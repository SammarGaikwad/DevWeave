import React, { useState, useEffect } from 'react';
import { 
  FileCode, 
  Terminal, 
  RefreshCw, 
  GitCommit, 
  KanbanSquare, 
  Sparkles 
} from 'lucide-react';
import { ChatBubble } from './ChatBubble';
import { QuickAction, type QuickActionProps } from './QuickAction';
import { InsightCard, type InsightCardProps } from './InsightCard';

const ANALYSIS_STEPS = [
  'GitHub Repository',
  'Jenkins Pipeline',
  'Docker Image',
  'Kubernetes Cluster',
  'Prometheus Metrics',
  'Logs',
];

const QUICK_ACTIONS: QuickActionProps[] = [
  { label: 'Generate Kubernetes YAML', icon: FileCode },
  { label: 'View Jenkins Logs', icon: Terminal },
  { label: 'Restart Deployment', icon: RefreshCw },
  { label: 'Open GitHub Commit', icon: GitCommit },
  { label: 'Create Jira Issue', icon: KanbanSquare },
  { label: 'Explain Error', icon: Sparkles },
];

const INSIGHTS_DATA: InsightCardProps[] = [
  { label: 'Deployments Today', value: '42' },
  { label: 'Critical Alerts', value: '2' },
  { label: 'Average Recovery Time', value: '6 min' },
  { label: 'AI Suggestions Applied', value: '87%' },
];

export const AISection: React.FC = () => {
  const [visibleStepsCount, setVisibleStepsCount] = useState<number>(0);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(true);
  const [showAnswer, setShowAnswer] = useState<boolean>(false);

  // Progressive analysis animation and 10-second auto-demo replay loop
  useEffect(() => {
    let timers: ReturnType<typeof setTimeout>[] = [];

    const runDemoCycle = () => {
      // Reset states
      setVisibleStepsCount(0);
      setIsAnalyzing(true);
      setShowAnswer(false);

      // Reveal steps sequentially
      ANALYSIS_STEPS.forEach((_, idx) => {
        const timer = setTimeout(() => {
          setVisibleStepsCount(idx + 1);
        }, 600 + idx * 500);
        timers.push(timer);
      });

      // Show final answer after all steps complete
      const finalTimer = setTimeout(() => {
        setIsAnalyzing(false);
        setShowAnswer(true);
      }, 600 + ANALYSIS_STEPS.length * 500 + 400);
      timers.push(finalTimer);
    };

    runDemoCycle();

    // Replay every 10 seconds
    const interval = setInterval(() => {
      timers.forEach(clearTimeout);
      timers = [];
      runDemoCycle();
    }, 10000);

    return () => {
      timers.forEach(clearTimeout);
      clearInterval(interval);
    };
  }, []);

  return (
    <section 
      id="ai-assistant" 
      className="relative z-10 w-full bg-black py-24 md:py-32 overflow-hidden select-none"
    >
      {/* Subtle background gradient & ambient glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-950/20 via-black to-black pointer-events-none z-0" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff08_1px,transparent_1px),linear-gradient(to_bottom,#ffffff08_1px,transparent_1px)] bg-[size:4rem_4rem] pointer-events-none z-0" />

      {/* Ambient background blur spheres */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main Section Container */}
      <div className="relative z-10 max-w-7xl mx-auto px-6">
        
        {/* Section Header */}
        <div className="flex flex-col items-start text-left mb-16 md:mb-20">
          <span className="text-xs uppercase tracking-widest text-white/50 font-semibold mb-3">
            AI ASSISTANT
          </span>
          <h2 className="text-4xl md:text-5xl font-bold text-white tracking-tight">
            Meet Your Engineering Copilot
          </h2>
          <p className="max-w-3xl text-lg leading-relaxed text-white/70 mt-4">
            DevWeave AI understands your entire engineering platform and helps developers troubleshoot, automate, and deliver software faster.
          </p>
        </div>

        {/* Main Interactive AI Chat Box Demo */}
        <div className="max-w-[1000px] mx-auto liquid-glass rounded-3xl p-6 md:p-8 border border-white/10 shadow-[0_0_60px_rgba(0,0,0,0.9)] relative overflow-hidden">
          
          {/* Subtle top ambient sheen */}
          <div className="absolute -top-32 -left-32 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* Chat Messages Container */}
          <div className="space-y-6">
            {/* Developer Prompt */}
            <ChatBubble 
              sender="developer" 
              message="Why did today's deployment fail?" 
            />

            {/* DevWeave AI Response */}
            <ChatBubble 
              sender="ai"
              analysisSteps={ANALYSIS_STEPS}
              visibleStepsCount={visibleStepsCount}
              isAnalyzing={isAnalyzing}
              showAnswer={showAnswer}
            />
          </div>

          {/* Action Panel Buttons (Revealed with Answer) */}
          <div 
            className={`mt-6 pt-6 border-t border-white/10 transition-all duration-500 ${
              showAnswer ? 'opacity-100 translate-y-0' : 'opacity-30 translate-y-2 pointer-events-none'
            }`}
          >
            <span className="text-[11px] font-semibold text-white/50 uppercase tracking-widest block mb-3">
              Suggested Quick Actions
            </span>
            <div className="flex flex-wrap items-center gap-2.5">
              {QUICK_ACTIONS.map((action) => (
                <QuickAction
                  key={action.label}
                  label={action.label}
                  icon={action.icon}
                />
              ))}
            </div>
          </div>

        </div>

        {/* Smart Insights Analytics Row */}
        <div className="mt-16 md:mt-24 grid grid-cols-2 lg:grid-cols-4 gap-6 max-w-[1000px] mx-auto">
          {INSIGHTS_DATA.map((insight) => (
            <InsightCard 
              key={insight.label}
              label={insight.label}
              value={insight.value}
            />
          ))}
        </div>

      </div>
    </section>
  );
};
