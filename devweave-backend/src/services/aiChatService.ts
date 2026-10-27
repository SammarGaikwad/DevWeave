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
  diagnosis?: DiagnosticResult;
  suggestedActions?: { label: string; action: string }[];
}

const SYSTEM_PROMPT = `You are the DevWeave AI Assistant, an expert DevOps engineer and cloud infrastructure specialist embedded into the DevWeave platform.
DevWeave is an integrated DevOps and container orchestration platform featuring:
- Kubernetes Management: Deployments, Pods, StatefulSets, DaemonSets, Services, Ingresses, PVCs, ConfigMaps, Secrets, Rollout Restarts, Scaling, and live inventory.
- Docker Management: Containers, Images, Networks, Volumes, and local runner execution.
- CI/CD Pipelines: Automated build stages, Jenkins integration, and GitHub repositories.
- Diagnostic Engine: Automated root-cause log failure analysis.

Provide concise, technically precise, and actionable assistance with code/CLI snippets formatted in markdown.`;

/**
 * Dispatches chat messages to the configured external LLM (OpenAI/Gemini)
 * or falls back to the deterministic DevOps heuristic diagnostic engine.
 */
export async function processChatMessage(
  message: string,
  history: ChatMessage[] = []
): Promise<ChatResponse> {
  const trimmed = message.trim();

  // 1. Check for real OpenAI integration
  if (env.OPENAI_API_KEY) {
    try {
      const openAiBaseUrl = env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
      const messages = [
        { role: 'system', content: SYSTEM_PROMPT },
        ...history.slice(-6).map((h) => ({ role: h.role, content: h.content })),
        { role: 'user', content: trimmed },
      ];

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000);

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
          max_tokens: 1000,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (res.ok) {
        const data = (await res.json()) as any;
        const reply = data.choices?.[0]?.message?.content?.trim();
        if (reply) {
          return {
            message: reply,
            isAIGenerated: true,
            engineType: 'LLM_PROVIDER',
            provider: 'OPENAI',
            modelName: env.OPENAI_MODEL,
          };
        }
      }
    } catch {
      // Fall through to deterministic engine if OpenAI network call fails
    }
  }

  // 2. Check for real Gemini integration
  if (env.GEMINI_API_KEY) {
    try {
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${env.GEMINI_MODEL}:generateContent?key=${env.GEMINI_API_KEY}`;
      const contents = [
        ...history.slice(-4).map((h) => ({
          role: h.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: h.content }],
        })),
        { role: 'user', parts: [{ text: `${SYSTEM_PROMPT}\n\nUser Question:\n${trimmed}` }] },
      ];

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000);

      const res = await fetch(geminiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (res.ok) {
        const data = (await res.json()) as any;
        const candidate = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (candidate) {
          return {
            message: candidate,
            isAIGenerated: true,
            engineType: 'LLM_PROVIDER',
            provider: 'GEMINI',
            modelName: env.GEMINI_MODEL,
          };
        }
      }
    } catch {
      // Fall through to deterministic engine if Gemini call fails
    }
  }

  // 3. Deterministic DevOps Diagnostic & Query Engine
  return processDeterministicDevOpsQuery(trimmed);
}

/**
 * Intelligent deterministic DevOps reasoning engine.
 * Retains and leverages the existing rule-based diagnostic engine,
 * identifying rule-based results with complete transparency.
 */
function processDeterministicDevOpsQuery(query: string): ChatResponse {
  const lower = query.toLowerCase();

  // A. Check if the message is a log snippet or error output
  const isLogOrError =
    query.includes('\n') ||
    lower.includes('error') ||
    lower.includes('failed') ||
    lower.includes('vitest: not found') ||
    lower.includes('ts2322') ||
    lower.includes('error ts') ||
    lower.includes('econnrefused') ||
    lower.includes('cannot connect to the docker daemon') ||
    lower.includes('heap out of memory') ||
    lower.includes('connection refused') ||
    lower.includes('exception');

  if (isLogOrError) {
    const diagnosis = diagnoseBuildLog(query);

    const fixesMarkdown = diagnosis.recommendedFixes
      .map(
        (fix, i) =>
          `**${i + 1}. ${fix.title}**\n${fix.description}${
            fix.command ? `\n\`\`\`bash\n${fix.command}\n\`\`\`` : ''
          }${fix.codeSnippet ? `\n\`\`\`typescript\n${fix.codeSnippet}\n\`\`\`` : ''}`
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

  // B. Kubernetes Guidance
  if (
    lower.includes('kubernetes') ||
    lower.includes('k8s') ||
    lower.includes('deployment') ||
    lower.includes('service') ||
    lower.includes('pod') ||
    lower.includes('ingress') ||
    lower.includes('pvc') ||
    lower.includes('scale') ||
    lower.includes('rollout')
  ) {
    let specificGuide = '';
    if (lower.includes('service')) {
      specificGuide = `
**Services in DevWeave:**
- **Create Service**: Open **Kubernetes → Networking → Services**, then click **+ Create Service**. Fill in service name, target port, protocol, and deployment selector.
- **Service Types**: Choose \`ClusterIP\` (internal), \`NodePort\` (node port 30000-32767), or \`LoadBalancer\` (cloud external IP).
- **Protection**: System services such as \`default/kubernetes\` are protected from accidental deletion.`;
    } else if (lower.includes('deployment') || lower.includes('scale') || lower.includes('rollout')) {
      specificGuide = `
**Deployment Management in DevWeave:**
- **Deploy Workload**: Open **Kubernetes → Workloads**, click **+ Deploy Workload** to specify image, replicas, ports, and resource limits.
- **Zero-Downtime Rollout Restart**: Click the **RotateCcw (Restart)** icon on any deployment or daemonset.
- **Scaling**: Click the **Sliders (Scale)** icon to adjust replica count instantly via \`kubectl scale\`.`;
    } else {
      specificGuide = `
**Kubernetes Dashboard Capabilities:**
- **Workloads**: Deployments, Pods, StatefulSets, DaemonSets, Jobs, CronJobs.
- **Networking**: Services, Ingresses, NetworkPolicies.
- **Config & Storage**: ConfigMaps, Secrets (audited reveal), PVCs, StorageClasses.
- **Cluster & Nodes**: Node conditions, allocatable resources, and namespace isolation.`;
    }

    return {
      message: `### ☸️ Kubernetes Resource Management
${specificGuide}

You can also paste raw manifests or execution logs into this chat anytime for instant validation and diagnosis.`,
      isAIGenerated: false,
      engineType: 'RULE_BASED_DIAGNOSTIC_ENGINE',
      provider: 'DETERMINISTIC_RULES',
      modelName: 'DevWeave Static Diagnostic Engine v1.0',
      suggestedActions: [
        { label: 'View Workloads', action: 'Navigate to Kubernetes Workloads' },
        { label: 'View Services', action: 'Navigate to Kubernetes Networking' },
      ],
    };
  }

  // C. Docker Guidance
  if (
    lower.includes('docker') ||
    lower.includes('container') ||
    lower.includes('image') ||
    lower.includes('volume') ||
    lower.includes('network')
  ) {
    return {
      message: `### 🐳 Docker Management in DevWeave

DevWeave integrates with your local Docker Desktop runner to provide live container orchestration:
- **Containers**: Launch containers with custom port mappings, restart policies, and environment variables. Start, stop, restart, or inspect logs in real time.
- **Images**: Pull images directly from Docker Hub, tag, or clean up unused image layers.
- **Networks & Volumes**: Create bridge networks and persistent named volumes to isolate application state.

**Common Tip:** If container launch fails, verify that your local Docker runner is running via \`npm run runner:docker\` and the daemon socket is accessible.`,
      isAIGenerated: false,
      engineType: 'RULE_BASED_DIAGNOSTIC_ENGINE',
      provider: 'DETERMINISTIC_RULES',
      modelName: 'DevWeave Static Diagnostic Engine v1.0',
      suggestedActions: [
        { label: 'Check Docker Status', action: 'Navigate to Docker Management' },
      ],
    };
  }

  // D. CI/CD & Pipeline Guidance
  if (lower.includes('pipeline') || lower.includes('jenkins') || lower.includes('build') || lower.includes('ci/cd')) {
    return {
      message: `### 🚀 CI/CD Pipeline Automation

DevWeave automates continuous integration and delivery across your repositories:
- **Pipeline Templates**: Node.js, Python, Java, Docker containerization, and Kubernetes deployments.
- **Execution Stages**: Code checkout, dependency resolution (\`npm ci\`), test execution (\`vitest\`), linting, and image push.
- **Jenkins Runner**: Automated trigger via Jenkins REST API with real-time log streaming.

If a pipeline build fails, copy the terminal log snippet and paste it right here — our diagnostic engine will pinpoint the exact failure cause.`,
      isAIGenerated: false,
      engineType: 'RULE_BASED_DIAGNOSTIC_ENGINE',
      provider: 'DETERMINISTIC_RULES',
      modelName: 'DevWeave Static Diagnostic Engine v1.0',
      suggestedActions: [
        { label: 'View Pipelines', action: 'Navigate to Pipelines' },
      ],
    };
  }

  // E. LLM Provider Configuration Question
  if (
    lower.includes('llm') ||
    lower.includes('openai') ||
    lower.includes('gemini') ||
    lower.includes('api key') ||
    lower.includes('configure')
  ) {
    return {
      message: `### 🤖 AI Provider Configuration

DevWeave is currently running on the **Built-in Deterministic DevOps Diagnostic Engine**.

To enable generative conversational LLM capabilities:
1. Open \`devweave-backend/.env\`
2. Add your provider API key:
   \`\`\`bash
   # OpenAI Option
   OPENAI_API_KEY=sk-...
   OPENAI_MODEL=gpt-4o-mini

   # OR Google Gemini Option
   GEMINI_API_KEY=AIzaSy...
   GEMINI_MODEL=gemini-1.5-flash
   \`\`\`
3. Restart the backend. DevWeave will automatically detect the key and switch to conversational LLM mode while preserving all deterministic diagnostic safety rules.`,
      isAIGenerated: false,
      engineType: 'RULE_BASED_DIAGNOSTIC_ENGINE',
      provider: 'DETERMINISTIC_RULES',
      modelName: 'DevWeave Static Diagnostic Engine v1.0',
    };
  }

  // F. Greetings & General Help
  return {
    message: `Hello! I am your **DevWeave AI Assistant**.

I can assist you across the platform with:
- 🔍 **Automated Log Diagnosis**: Paste any build or runtime error trace for instant root-cause analysis and copyable fixes.
- ☸️ **Kubernetes Workloads**: Guidance on Deployments, Services, Ingress, Pod logs, and scaling.
- 🐳 **Docker Operations**: Troubleshooting container networking, volumes, and runner connections.
- 🚀 **Pipelines & CI/CD**: Jenkins build triggers, dependency resolution, and test runners.

Try asking:
- *"How do I create a Kubernetes Service?"*
- *"Why did my build fail with vitest: not found?"*
- *"Troubleshoot Docker daemon offline"*
- *"How do I connect an OpenAI or Gemini API key?"*`,
    isAIGenerated: false,
    engineType: 'RULE_BASED_DIAGNOSTIC_ENGINE',
    provider: 'DETERMINISTIC_RULES',
    modelName: 'DevWeave Static Diagnostic Engine v1.0',
    suggestedActions: [
      { label: 'Diagnose Error', action: 'Paste error log' },
      { label: 'Kubernetes Help', action: 'How do I deploy a service?' },
      { label: 'Docker Help', action: 'Troubleshoot Docker' },
    ],
  };
}
