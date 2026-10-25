export interface DetectedStack {
  language: string;
  framework: string;
  projectType: 'frontend' | 'backend' | 'fullstack' | 'service';
  packageManager: string;
  buildCommand?: string;
  startCommand: string;
  defaultPort: number;
  envVars: string[];
  isMonorepo: boolean;
  subprojects?: Array<{
    name: string;
    path: string;
    language: string;
    framework: string;
    port: number;
  }>;
  existingDockerfile?: string;
  existingCompose?: string;
  confidence: 'high' | 'medium' | 'low';
  warnings: string[];
  assumptions: string[];
}

export interface ProjectFileEntry {
  path: string;
  type: 'file' | 'dir';
  content?: string;
}

/**
 * Inspects a flat or nested map of project files and determines the project stack,
 * runtime requirements, and candidate build commands.
 */
export function analyzeProjectFiles(files: ProjectFileEntry[]): DetectedStack {
  const fileMap = new Map<string, ProjectFileEntry>();
  for (const f of files) {
    const normalized = f.path.replace(/^\/+/, '');
    fileMap.set(normalized, f);
  }

  const hasFile = (name: string) => fileMap.has(name);
  const getFileContent = (name: string): string | undefined => fileMap.get(name)?.content;

  const warnings: string[] = [];
  const assumptions: string[] = [];

  // Check for existing Docker configurations
  const existingDockerfile = getFileContent('Dockerfile') || getFileContent('dockerfile');
  const existingCompose =
    getFileContent('docker-compose.yml') ||
    getFileContent('docker-compose.yaml') ||
    getFileContent('compose.yaml') ||
    getFileContent('compose.yml');

  // Check for fullstack multi-directory pattern (e.g. client/server, frontend/backend)
  const dirNames = files
    .filter((f) => f.type === 'dir' || f.path.includes('/'))
    .map((f) => f.path.split('/')[0]);
  const uniqueDirs = new Set(dirNames);

  const hasFrontendDir = ['frontend', 'client', 'web', 'ui', 'app'].find((d) => uniqueDirs.has(d));
  const hasBackendDir = ['backend', 'server', 'api'].find((d) => uniqueDirs.has(d));

  if (hasFrontendDir && hasBackendDir) {
    return {
      language: 'JavaScript/TypeScript (Full-Stack)',
      framework: 'Full-Stack (Client + Server)',
      projectType: 'fullstack',
      packageManager: hasFile('pnpm-lock.yaml') ? 'pnpm' : hasFile('yarn.lock') ? 'yarn' : 'npm',
      buildCommand: 'npm run build',
      startCommand: 'npm start',
      defaultPort: 8080,
      envVars: ['PORT', 'NODE_ENV'],
      isMonorepo: true,
      subprojects: [
        {
          name: hasFrontendDir,
          path: `./${hasFrontendDir}`,
          language: 'JavaScript/TypeScript',
          framework: 'Frontend',
          port: 5173,
        },
        {
          name: hasBackendDir,
          path: `./${hasBackendDir}`,
          language: 'JavaScript/TypeScript',
          framework: 'Backend API',
          port: 8080,
        },
      ],
      existingDockerfile,
      existingCompose,
      confidence: 'high',
      warnings: ['Detected multiple service directories. We recommend generating a multi-service Docker Compose configuration.'],
      assumptions: ['Assuming frontend runs on port 5173 and backend on port 8080.'],
    };
  }

  // 1. Node.js detection (package.json)
  if (hasFile('package.json')) {
    let pkg: any = {};
    try {
      const raw = getFileContent('package.json');
      if (raw) pkg = JSON.parse(raw);
    } catch {
      warnings.push('Could not parse package.json as valid JSON.');
    }

    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    const scripts = pkg.scripts || {};

    let packageManager = 'npm';
    if (hasFile('pnpm-lock.yaml')) packageManager = 'pnpm';
    else if (hasFile('yarn.lock')) packageManager = 'yarn';
    else if (hasFile('bun.lockb')) packageManager = 'bun';

    let framework = 'Node.js Application';
    let projectType: 'frontend' | 'backend' | 'fullstack' | 'service' = 'backend';
    let defaultPort = 3000;
    let buildCommand: string | undefined = scripts.build ? `${packageManager} run build` : undefined;
    let startCommand = scripts.start ? `${packageManager} start` : 'node index.js';

    if (deps.next) {
      framework = 'Next.js';
      projectType = 'fullstack';
      defaultPort = 3000;
      startCommand = `${packageManager} run start`;
      assumptions.push('Configured for standalone Next.js production server.');
    } else if (deps.vite || deps['@vitejs/plugin-react'] || deps['@vitejs/plugin-vue']) {
      framework = 'React / Vite';
      projectType = 'frontend';
      defaultPort = 80;
      buildCommand = `${packageManager} run build`;
      startCommand = 'nginx -g "daemon off;"';
      assumptions.push('Static SPA built with Vite; served via high-performance Nginx.');
    } else if (deps.express) {
      framework = 'Express.js';
      projectType = 'backend';
      defaultPort = 8080;
      if (deps.typescript || hasFile('tsconfig.json')) {
        framework = 'Express.js (TypeScript)';
        buildCommand = scripts.build ? `${packageManager} run build` : 'npm run build';
        startCommand = scripts.start ? `${packageManager} start` : 'node dist/server.js';
      }
    } else if (deps['@nestjs/core']) {
      framework = 'NestJS';
      projectType = 'backend';
      defaultPort = 3000;
      buildCommand = `${packageManager} run build`;
      startCommand = 'node dist/main.js';
    } else if (deps.fastify) {
      framework = 'Fastify';
      projectType = 'backend';
      defaultPort = 8080;
    }

    if (pkg.engines?.node) {
      assumptions.push(`Node engine requirement specified: ${pkg.engines.node}`);
    }

    return {
      language: deps.typescript || hasFile('tsconfig.json') ? 'TypeScript' : 'JavaScript',
      framework,
      projectType,
      packageManager,
      buildCommand,
      startCommand,
      defaultPort,
      envVars: ['PORT', 'NODE_ENV'],
      isMonorepo: Boolean(pkg.workspaces),
      existingDockerfile,
      existingCompose,
      confidence: 'high',
      warnings,
      assumptions,
    };
  }

  // 2. Python detection
  if (hasFile('requirements.txt') || hasFile('pyproject.toml') || hasFile('Pipfile')) {
    let framework = 'Python';
    let defaultPort = 8000;
    let startCommand = 'python main.py';
    const reqs = getFileContent('requirements.txt') || '';
    const pyproject = getFileContent('pyproject.toml') || '';

    if (reqs.includes('fastapi') || pyproject.includes('fastapi')) {
      framework = 'FastAPI';
      startCommand = 'uvicorn main:app --host 0.0.0.0 --port 8000';
    } else if (reqs.includes('flask') || pyproject.includes('flask')) {
      framework = 'Flask';
      defaultPort = 5000;
      startCommand = 'gunicorn --bind 0.0.0.0:5000 app:app';
    } else if (reqs.includes('django') || pyproject.includes('django')) {
      framework = 'Django';
      startCommand = 'gunicorn --bind 0.0.0.0:8000 myproject.wsgi:application';
    }

    return {
      language: 'Python',
      framework,
      projectType: 'backend',
      packageManager: hasFile('Pipfile') ? 'pipenv' : hasFile('pyproject.toml') ? 'poetry' : 'pip',
      startCommand,
      defaultPort,
      envVars: ['PORT', 'PYTHONUNBUFFERED'],
      isMonorepo: false,
      existingDockerfile,
      existingCompose,
      confidence: 'high',
      warnings,
      assumptions: ['Using Python 3.11 slim base image with non-root security context.'],
    };
  }

  // 3. Java detection
  if (hasFile('pom.xml')) {
    const pom = getFileContent('pom.xml') || '';
    const isSpring = pom.includes('spring-boot');

    return {
      language: 'Java',
      framework: isSpring ? 'Spring Boot' : 'Java Application',
      projectType: 'backend',
      packageManager: 'Maven',
      buildCommand: './mvnw clean package -DskipTests',
      startCommand: 'java -jar target/*.jar',
      defaultPort: 8080,
      envVars: ['JAVA_OPTS', 'PORT'],
      isMonorepo: false,
      existingDockerfile,
      existingCompose,
      confidence: 'high',
      warnings,
      assumptions: ['Using Maven multi-stage build with Eclipse Temurin 21 JRE for runtime.'],
    };
  }

  if (hasFile('build.gradle') || hasFile('build.gradle.kts')) {
    return {
      language: 'Java/Kotlin',
      framework: 'Gradle Application',
      projectType: 'backend',
      packageManager: 'Gradle',
      buildCommand: './gradlew build --no-daemon -x test',
      startCommand: 'java -jar build/libs/*.jar',
      defaultPort: 8080,
      envVars: ['JAVA_OPTS', 'PORT'],
      isMonorepo: false,
      existingDockerfile,
      existingCompose,
      confidence: 'high',
      warnings,
      assumptions: ['Using Gradle wrapper multi-stage build with Eclipse Temurin 21.'],
    };
  }

  // 4. PHP detection
  if (hasFile('composer.json')) {
    let framework = 'PHP';
    const composerRaw = getFileContent('composer.json') || '';
    if (composerRaw.includes('laravel/framework')) framework = 'Laravel';
    else if (composerRaw.includes('symfony/framework-bundle')) framework = 'Symfony';

    return {
      language: 'PHP',
      framework,
      projectType: 'backend',
      packageManager: 'Composer',
      startCommand: 'php-fpm',
      defaultPort: 80,
      envVars: ['APP_ENV', 'PORT'],
      isMonorepo: false,
      existingDockerfile,
      existingCompose,
      confidence: 'medium',
      warnings,
      assumptions: ['Using PHP 8.2 FPM with production opcache.'],
    };
  }

  // 5. Existing Dockerfile fallback
  if (existingDockerfile) {
    return {
      language: 'Docker',
      framework: 'Custom Container',
      projectType: 'service',
      packageManager: 'docker',
      startCommand: 'Default CMD from Dockerfile',
      defaultPort: 8080,
      envVars: [],
      isMonorepo: false,
      existingDockerfile,
      existingCompose,
      confidence: 'medium',
      warnings: ['Existing Dockerfile found. Configuration generation will respect and preserve existing rules unless you choose to update it.'],
      assumptions: ['Pre-existing Dockerfile verified in repository root.'],
    };
  }

  // Ambiguous project detection
  return {
    language: 'Generic',
    framework: 'Standard Application',
    projectType: 'service',
    packageManager: 'unknown',
    startCommand: 'sh run.sh',
    defaultPort: 8080,
    envVars: ['PORT'],
    isMonorepo: false,
    confidence: 'low',
    warnings: [
      'No standard package manifest (package.json, pom.xml, requirements.txt, composer.json) recognized at repository root.',
    ],
    assumptions: ['Please review and verify build and start commands before launching a build.'],
  };
}
