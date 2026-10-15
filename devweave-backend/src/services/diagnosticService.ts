export interface DiagnosticResult {
  engineType: 'RULE_BASED_DIAGNOSTIC_ENGINE';
  isAIGenerated: false;
  signature: string;
  category: 'DEPENDENCY_RESOLUTION' | 'NETWORK_CONNECTIVITY' | 'COMPILATION_ERROR' | 'TEST_FAILURE' | 'DOCKER_CONTAINER' | 'KUBERNETES' | 'AUTHENTICATION' | 'MEMORY_EXHAUSTION' | 'UNKNOWN';
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

export function diagnoseBuildLog(logText: string): DiagnosticResult {
  const text = logText || '';

  // 1. Vitest / npm ci devDependencies missing
  if (text.includes('vitest: not found') || (text.includes('sh: 1:') && text.includes('vitest'))) {
    return {
      engineType: 'RULE_BASED_DIAGNOSTIC_ENGINE',
      isAIGenerated: false,
      signature: 'RULE_VITEST_NOT_FOUND',
      category: 'DEPENDENCY_RESOLUTION',
      title: 'Missing Vitest Binary in CI Execution Context',
      severity: 'CRITICAL',
      rootCause:
        'The CI runner executed "npm test", but the vitest binary was not found in node_modules/.bin/vitest. This occurs when "npm ci" is executed in the repository root instead of the backend subdirectory, or when NODE_ENV=production causes npm to omit devDependencies.',
      pinpointedLogSnippet: 'sh: 1: vitest: not found',
      recommendedFixes: [
        {
          title: 'Include devDependencies in CI Install',
          description: 'Update the pipeline install command to force development dependency installation even in CI.',
          command: 'npm ci --include=dev',
        },
        {
          title: 'Ensure Execution in Target Directory',
          description: 'Wrap the install and test stages inside dir("devweave-backend") in your Jenkinsfile.',
          codeSnippet: `dir('devweave-backend') {
    sh 'npm ci --include=dev'
    sh 'npm test --if-present'
}`,
        },
      ],
      preventionGuideline:
        'Always set NODE_ENV=test in automated testing pipeline stages and verify workspace directory before running package-manager scripts.',
    };
  }

  // 2. TypeScript compilation error
  if (text.includes('error TS') || text.includes('tsc -b') || text.includes('tsc')) {
    const match = text.match(/(.*?\.(?:ts|tsx))\((.*?)\):\s*error\s*(TS\d+):\s*(.*)/);
    const file = match ? match[1] : 'TypeScript Source';
    const line = match ? match[2] : 'unknown line';
    const code = match ? match[3] : 'TS error';
    const msg = match ? match[4] : 'Type checking failed';

    return {
      engineType: 'RULE_BASED_DIAGNOSTIC_ENGINE',
      isAIGenerated: false,
      signature: 'RULE_TYPESCRIPT_COMPILATION_ERROR',
      category: 'COMPILATION_ERROR',
      title: `TypeScript Compilation Failure (${code})`,
      severity: 'HIGH',
      rootCause: `Static type checking failed in ${file} at line ${line}. Error: ${msg}`,
      pinpointedLogSnippet: match ? match[0] : 'error TS: Type checking failed',
      recommendedFixes: [
        {
          title: 'Run Local Type Check',
          description: 'Reproduce the compiler output locally before pushing commits.',
          command: 'npx tsc --noEmit',
        },
        {
          title: 'Check Unused Variables / Imports',
          description: 'DevWeave enables noUnusedLocals. Ensure all imported symbols and declared variables are used or removed.',
        },
      ],
      preventionGuideline:
        'Configure a pre-commit Git hook running "tsc --noEmit" to catch compiler mismatches before pushing.',
    };
  }

  // 3. Network Connection Refused / Port Block
  if (
    text.includes('ECONNREFUSED') ||
    text.includes('connectex') ||
    text.includes('Connection refused') ||
    text.includes('timed out after')
  ) {
    return {
      engineType: 'RULE_BASED_DIAGNOSTIC_ENGINE',
      isAIGenerated: false,
      signature: 'RULE_NETWORK_CONNECTION_REFUSED',
      category: 'NETWORK_CONNECTIVITY',
      title: 'Target Service Connection Refused / Network Timeout',
      severity: 'CRITICAL',
      rootCause:
        'The client or backend attempted to connect to a service address (e.g. Jenkins runner, PostgreSQL, or local port) that is either offline, not listening on the expected interface (0.0.0.0), or blocked by firewall/security group rules.',
      pinpointedLogSnippet: text.match(/.*(?:ECONNREFUSED|connectex|timed out).*/)?.[0] || 'Connection refused',
      recommendedFixes: [
        {
          title: 'Verify Service Daemon Status',
          description: 'Check whether the target daemon is active and listening.',
          command: 'curl -I http://localhost:8080/api/health',
        },
        {
          title: 'Inspect Azure NSG / Firewall Rules',
          description: 'If targeting cloud VM, ensure inbound TCP port 8080 allows traffic from Render/IP.',
        },
      ],
      preventionGuideline:
        'Always implement retry backoffs and health checks before sending synchronous pipeline build commands.',
    };
  }

  // 4. Docker daemon offline
  if (
    text.includes('Cannot connect to the Docker daemon') ||
    text.includes('pipe/dockerDesktop') ||
    text.includes('docker: command not found')
  ) {
    return {
      engineType: 'RULE_BASED_DIAGNOSTIC_ENGINE',
      isAIGenerated: false,
      signature: 'RULE_DOCKER_DAEMON_OFFLINE',
      category: 'DOCKER_CONTAINER',
      title: 'Docker Engine Offline or Daemon Unreachable',
      severity: 'HIGH',
      rootCause:
        'Docker CLI is present but cannot communicate with the Docker daemon socket (named pipe or /var/run/docker.sock).',
      pinpointedLogSnippet: 'Cannot connect to the Docker daemon',
      recommendedFixes: [
        {
          title: 'Start Docker Desktop',
          description: 'Launch Docker Desktop on Windows or start the systemd service on Linux.',
          command: 'sudo systemctl start docker',
        },
      ],
      preventionGuideline:
        'Verify Docker daemon liveness using "docker info" in pipeline pre-flight checks before executing container build stages.',
    };
  }

  // 5. Memory exhaustion
  if (text.includes('JavaScript heap out of memory') || text.includes('OutOfMemoryError')) {
    return {
      engineType: 'RULE_BASED_DIAGNOSTIC_ENGINE',
      isAIGenerated: false,
      signature: 'RULE_MEMORY_EXHAUSTION',
      category: 'MEMORY_EXHAUSTION',
      title: 'Process Memory Exhaustion (OOM)',
      severity: 'CRITICAL',
      rootCause: 'Node.js or Java runtime exceeded heap memory quota during compilation or test execution.',
      pinpointedLogSnippet: 'JavaScript heap out of memory',
      recommendedFixes: [
        {
          title: 'Increase Node Heap Space',
          description: 'Expand the default memory allocation via NODE_OPTIONS in CI environment.',
          command: 'export NODE_OPTIONS="--max-old-space-size=4096"',
        },
      ],
      preventionGuideline: 'Monitor memory utilization in CI build nodes and avoid unbounded bundle sizes.',
    };
  }

  // Default Fallback
  return {
    engineType: 'RULE_BASED_DIAGNOSTIC_ENGINE',
    isAIGenerated: false,
    signature: 'RULE_GENERAL_PIPELINE_TRIAGE',
    category: 'UNKNOWN',
    title: 'General Execution Triage Analysis',
    severity: 'MEDIUM',
    rootCause:
      'Log output does not match an established automated failure signature. Review the recent stage exit codes and stdout/stderr output.',
    recommendedFixes: [
      {
        title: 'Check Stage Exit Codes',
        description: 'Locate the earliest stage reporting non-zero status in the console log view.',
      },
      {
        title: 'Inspect Environment Variables',
        description: 'Verify all required credentials, database URLs, and API tokens are configured in the job.',
      },
    ],
    preventionGuideline:
      'Enable verbose logging flags (e.g. npm test -- --verbose) to capture granular stack traces.',
  };
}
