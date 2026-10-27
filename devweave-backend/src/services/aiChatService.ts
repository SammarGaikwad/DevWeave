import { env } from '../config/env.js';
import { diagnoseBuildLog, type DiagnosticResult } from './diagnosticService.js';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ChatResponse {
  message: string;
  isAIGenerated: boolean;
  engineType: 'LLM_PROVIDER' | 'RULE_BASED_DIAGNOSTIC_ENGINE';
  provider: 'OPENAI' | 'GEMINI' | 'DETERMINISTIC_RULES';
  modelName: string;
  isProviderConfigured?: boolean;
  isProviderError?: boolean;
  diagnosis?: DiagnosticResult;
  suggestedActions?: { label: string; action: string }[];
}

export const DEVOPS_COPILOT_SYSTEM_PROMPT = `You are the DevWeave AI Assistant, an expert DevOps engineering copilot and cloud infrastructure specialist embedded into the DevWeave platform.

Your mission is to help engineers troubleshoot build failures, configure CI/CD pipelines, optimize Docker containers, manage Kubernetes workloads, and understand application code.

Core Operating Principles:
1. Technical Precision: Provide technically rigorous, production-grade solutions. Explain the root causes behind errors, not just copy-paste snippets.
2. Safety & Caution: ALWAYS flag potentially destructive commands (e.g. "kubectl delete", "docker rm -f", "rm -rf", "git reset --hard", database drops) with explicit [WARNING: DESTRUCTIVE ACTION] callouts before showing them.
3. Transparency: Distinguish verified facts from hypotheses. If log output or context is incomplete, clearly state what information is missing and ask clarifying questions.
4. Boundaries: You are an advisory copilot. You cannot directly execute shell commands, modify cluster states, or trigger cloud deployments on the user's infrastructure without them running the commands themselves. Do not hallucinate having live access to private clusters, credentials, or repositories unless the user provides the context in the chat.
5. Code Formatting: Format code, scripts, manifests, and CLI commands cleanly using GitHub-flavored markdown with language tags (e.g. bash, typescript, yaml, dockerfile, json). Include verification commands (e.g. "kubectl get pods", "docker ps") so the user can verify their fix.`;

/**
 * Dispatches chat messages to the configured external LLM (OpenAI or Gemini),
 * returning real generative AI responses when configured, or transparent
 * provider-unavailable messages and deterministic diagnostics when unconfigured.
 */
export async function processChatMessage(
  message: string,
  history: ChatMessage[] = []
): Promise<ChatResponse> {
  const trimmed = message.trim();

  // 1. Check for real OpenAI integration
  if (env.OPENAI_API_KEY) {
    const openAiBaseUrl = env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
    const messages = [
      { role: 'system', content: DEVOPS_COPILOT_SYSTEM_PROMPT },
      ...history.slice(-8).map((h) => ({ role: h.role, content: h.content })),
      { role: 'user', content: trimmed },
    ];

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      const res = await fetch(`${openAiBaseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: env.OPENAI_MODEL,
          messages,
          temperature: 0.3,
          max_tokens: 1500,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        const errorBody = (await res.json().catch(() => ({}))) as any;
        const errMsg = errorBody?.error?.message || res.statusText || 'Unknown provider error';

        if (res.status === 401) {
          return {
            message: `### 🔒 OpenAI Authentication Error\n\nThe configured \`OPENAI_API_KEY\` was rejected by OpenAI (HTTP 401).\n\n**Details:** ${errMsg}\n\nPlease verify your API key in the backend environment configuration.`,
            isAIGenerated: false,
            engineType: 'LLM_PROVIDER',
            provider: 'OPENAI',
            modelName: env.OPENAI_MODEL,
            isProviderError: true,
          };
        }
        if (res.status === 429) {
          return {
            message: `### ⚠️ OpenAI Rate Limit / Quota Exceeded\n\nOpenAI returned HTTP 429: Rate limit or credit quota exceeded.\n\n**Details:** ${errMsg}\n\nPlease check your OpenAI billing plan and usage quota.`,
            isAIGenerated: false,
            engineType: 'LLM_PROVIDER',
            provider: 'OPENAI',
            modelName: env.OPENAI_MODEL,
            isProviderError: true,
          };
        }
        return {
          message: `### ⚠️ OpenAI Provider Error (${res.status})\n\nOpenAI request failed: ${errMsg}`,
          isAIGenerated: false,
          engineType: 'LLM_PROVIDER',
          provider: 'OPENAI',
          modelName: env.OPENAI_MODEL,
          isProviderError: true,
        };
      }

      const data = (await res.json()) as any;
      const reply = data.choices?.[0]?.message?.content?.trim();
      if (reply) {
        return {
          message: reply,
          isAIGenerated: true,
          engineType: 'LLM_PROVIDER',
          provider: 'OPENAI',
          modelName: env.OPENAI_MODEL,
          isProviderConfigured: true,
        };
      }
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        return {
          message: `### ⏱️ OpenAI Request Timeout\n\nThe request to OpenAI timed out after 30 seconds. Please try again with a shorter prompt or verify connectivity.`,
          isAIGenerated: false,
          engineType: 'LLM_PROVIDER',
          provider: 'OPENAI',
          modelName: env.OPENAI_MODEL,
          isProviderError: true,
        };
      }
      return {
        message: `### ⚠️ OpenAI Connection Failure\n\nFailed to connect to OpenAI endpoint: ${err.message || 'Network error'}`,
        isAIGenerated: false,
        engineType: 'LLM_PROVIDER',
        provider: 'OPENAI',
        modelName: env.OPENAI_MODEL,
        isProviderError: true,
      };
    }
  }

  // 2. Check for real Gemini integration
  if (env.GEMINI_API_KEY) {
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${env.GEMINI_MODEL}:generateContent?key=${env.GEMINI_API_KEY}`;
    const contents = [
      ...history.slice(-6).map((h) => ({
        role: h.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: h.content }],
      })),
      { role: 'user', parts: [{ text: `${DEVOPS_COPILOT_SYSTEM_PROMPT}\n\nUser Question:\n${trimmed}` }] },
    ];

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      const res = await fetch(geminiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        const errorBody = (await res.json().catch(() => ({}))) as any;
        const errMsg = errorBody?.error?.message || res.statusText || 'Gemini error';
        return {
          message: `### ⚠️ Gemini Provider Error (${res.status})\n\nGoogle Gemini request failed: ${errMsg}`,
          isAIGenerated: false,
          engineType: 'LLM_PROVIDER',
          provider: 'GEMINI',
          modelName: env.GEMINI_MODEL,
          isProviderError: true,
        };
      }

      const data = (await res.json()) as any;
      const candidate = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      if (candidate) {
        return {
          message: candidate,
          isAIGenerated: true,
          engineType: 'LLM_PROVIDER',
          provider: 'GEMINI',
          modelName: env.GEMINI_MODEL,
          isProviderConfigured: true,
        };
      }
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        return {
          message: `### ⏱️ Gemini Request Timeout\n\nThe request to Google Gemini timed out after 30 seconds.`,
          isAIGenerated: false,
          engineType: 'LLM_PROVIDER',
          provider: 'GEMINI',
          modelName: env.GEMINI_MODEL,
          isProviderError: true,
        };
      }
      return {
        message: `### ⚠️ Gemini Connection Failure\n\nFailed to connect to Google Gemini endpoint: ${err.message || 'Network error'}`,
        isAIGenerated: false,
        engineType: 'LLM_PROVIDER',
        provider: 'GEMINI',
        modelName: env.GEMINI_MODEL,
        isProviderError: true,
      };
    }
  }

  // 3. Fallback when neither OpenAI nor Gemini is configured
  // Check if user is asking to diagnose a build/test log snippet
  const isLogOrError =
    trimmed.includes('\n') &&
    (trimmed.toLowerCase().includes('error') ||
      trimmed.toLowerCase().includes('failed') ||
      trimmed.toLowerCase().includes('vitest') ||
      trimmed.toLowerCase().includes('ts2322') ||
      trimmed.toLowerCase().includes('econnrefused') ||
      trimmed.toLowerCase().includes('docker daemon') ||
      trimmed.toLowerCase().includes('crashloopbackoff') ||
      trimmed.toLowerCase().includes('imagepullbackoff') ||
      trimmed.toLowerCase().includes('exception'));

  if (isLogOrError) {
    const diagnosis = diagnoseBuildLog(trimmed);

    const fixesMarkdown = diagnosis.recommendedFixes
      .map(
        (fix, i) =>
          `**${i + 1}. ${fix.title}**\n${fix.description}${
            fix.command ? `\n\`\`\`bash\n${fix.command}\n\`\`\`` : ''
          }${fix.codeSnippet ? `\n\`\`\`\n${fix.codeSnippet}\n\`\`\`` : ''}`
      )
      .join('\n\n');

    const reply = `### 🔍 Automated DevOps Diagnosis

**Issue Identified:** ${diagnosis.title}  
**Category:** \`${diagnosis.category}\` | **Severity:** \`${diagnosis.severity}\`

**Root Cause:**  
${diagnosis.rootCause}

${diagnosis.pinpointedLogSnippet ? `**Pinpointed Log Snippet:**\n\`\`\`\n${diagnosis.pinpointedLogSnippet}\n\`\`\`\n` : ''}
**Recommended Fixes:**  
${fixesMarkdown}

**Prevention Guideline:**  
${diagnosis.preventionGuideline}

*(Analysis provided by DevWeave Built-in Deterministic Diagnostic Engine)*`;

    return {
      message: reply,
      isAIGenerated: false,
      engineType: 'RULE_BASED_DIAGNOSTIC_ENGINE',
      provider: 'DETERMINISTIC_RULES',
      modelName: 'DevWeave Static Diagnostic Engine v1.0',
      diagnosis,
      suggestedActions: diagnosis.recommendedFixes.map((f) => ({
        label: f.title,
        action: f.command || f.title,
      })),
    };
  }

  // Otherwise, return truthful status: AI provider is not configured
  return {
    message: `### ⚙️ DevWeave AI Assistant — Provider Configuration Required

DevWeave features a **Real Conversational AI Copilot**, but no external generative AI provider credentials have been configured on this backend server yet.

#### How to Enable Real Conversational AI:
Set either **OpenAI** or **Google Gemini** in your backend environment variables (\`devweave-backend/.env\` or Render Environment Settings):

\`\`\`bash
# Option 1: OpenAI (Recommended)
OPENAI_API_KEY=sk-proj-...
OPENAI_MODEL=gpt-4o-mini

# Option 2: Google Gemini
GEMINI_API_KEY=AIzaSy...
GEMINI_MODEL=gemini-1.5-flash
\`\`\`

*(Once configured and restarted, DevWeave will engage in full multi-turn conversational reasoning powered by your chosen model.)*

---
💡 **Looking for Log Analysis?**  
You can use the **DevOps Diagnostic Engine** tab to diagnose CI/CD, Kubernetes, and Docker failure logs right now using our built-in deterministic heuristic engine without needing an external API key!`,
    isAIGenerated: false,
    engineType: 'RULE_BASED_DIAGNOSTIC_ENGINE',
    provider: 'DETERMINISTIC_RULES',
    modelName: 'None',
    isProviderConfigured: false,
    suggestedActions: [
      { label: 'Diagnose Vitest Error', action: 'Why did my build fail with vitest: not found?' },
      { label: 'Troubleshoot Kubernetes Pod', action: 'Events:\n  Warning  BackOff  kubelet  Back-off restarting failed container web-app (exit code 137)' },
      { label: 'Troubleshoot Docker Daemon', action: 'Cannot connect to the Docker daemon at unix:///var/run/docker.sock' },
    ],
  };
}
