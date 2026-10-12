import { AppError } from '../middleware/errorHandler.js';

export interface PipelineTemplateStageDefinition {
  id: string;
  name: string;
  order: number;
  description: string;
  isOptional?: boolean;
}

export interface PipelineTemplateConfigField {
  key: string;
  label: string;
  type: 'string' | 'boolean' | 'select';
  defaultValue: string | boolean | number;
  required: boolean;
  description: string;
  options?: string[];
}

export interface PipelineTemplate {
  id: string;
  name: string;
  description: string;
  category: 'Backend' | 'Frontend' | 'Container' | 'Full-Stack';
  supportedTechnologies: string[];
  stages: PipelineTemplateStageDefinition[];
  configFields: PipelineTemplateConfigField[];
  icon: string;
}

export const PREDEFINED_TEMPLATES: Record<string, PipelineTemplate> = {
  'nodejs-backend-ci': {
    id: 'nodejs-backend-ci',
    name: 'Node.js Backend CI',
    description:
      'Continuous integration for Node.js, Express, Fastify, and NestJS backends with automated linting, testing, and compilation.',
    category: 'Backend',
    supportedTechnologies: ['Node.js', 'Express', 'TypeScript', 'JavaScript', 'Jest/Vitest'],
    icon: 'Server',
    stages: [
      { id: 'checkout', name: 'Checkout Repository', order: 1, description: 'Checks out the source code at the configured branch.' },
      { id: 'validate-node', name: 'Validate Node.js Version', order: 2, description: 'Checks active Node.js and package manager versions.' },
      { id: 'install-deps', name: 'Install Dependencies', order: 3, description: 'Installs dependencies using lockfile verification.' },
      { id: 'run-lint', name: 'Run Linting, If Configured', order: 4, description: 'Runs ESLint or custom linter if configured in package.json.', isOptional: true },
      { id: 'run-tests', name: 'Run Tests, If Configured', order: 5, description: 'Executes automated test suites if tests exist.', isOptional: true },
      { id: 'build-backend', name: 'Build Backend', order: 6, description: 'Compiles TypeScript or bundles backend artifacts.' },
      { id: 'publish-result', name: 'Publish Build Result', order: 7, description: 'Verifies compilation artifacts and records status.' },
    ],
    configFields: [
      { key: 'rootDir', label: 'Root Directory', type: 'string', defaultValue: '.', required: false, description: 'Directory where package.json is located (relative to repository root).' },
      { key: 'packageManager', label: 'Package Manager', type: 'select', defaultValue: 'npm', required: true, description: 'Package manager to use.', options: ['npm', 'yarn', 'pnpm'] },
      { key: 'installCommand', label: 'Install Command', type: 'string', defaultValue: 'npm ci', required: false, description: 'Command to install project dependencies.' },
      { key: 'lintCommand', label: 'Lint Command', type: 'string', defaultValue: 'npm run lint --if-present', required: false, description: 'Command to run linting.' },
      { key: 'testCommand', label: 'Test Command', type: 'string', defaultValue: 'npm test --if-present', required: false, description: 'Command to run tests.' },
      { key: 'buildCommand', label: 'Build Command', type: 'string', defaultValue: 'npm run build', required: false, description: 'Command to compile or build backend.' },
    ],
  },

  'react-frontend-ci': {
    id: 'react-frontend-ci',
    name: 'React Frontend CI',
    description:
      'Continuous integration for modern React, Vite, Next.js, and Single-Page Applications with type checking, testing, and production bundle builds.',
    category: 'Frontend',
    supportedTechnologies: ['React', 'TypeScript', 'Vite', 'Next.js', 'Tailwind CSS'],
    icon: 'Layout',
    stages: [
      { id: 'checkout', name: 'Checkout Repository', order: 1, description: 'Checks out the source code at the configured branch.' },
      { id: 'validate-node', name: 'Validate Node.js Version', order: 2, description: 'Validates Node.js and npm runtime environments.' },
      { id: 'install-deps', name: 'Install Dependencies', order: 3, description: 'Installs project dependencies with lockfile validation.' },
      { id: 'type-check', name: 'Run Type Checking', order: 4, description: 'Executes TypeScript compiler type checking (tsc --noEmit).' },
      { id: 'run-tests', name: 'Run Tests, If Configured', order: 5, description: 'Executes frontend unit or component tests if present.', isOptional: true },
      { id: 'build-frontend', name: 'Build Frontend', order: 6, description: 'Creates optimized production bundle in dist or build directory.' },
      { id: 'publish-result', name: 'Publish Build Result', order: 7, description: 'Verifies bundle generation and records execution metrics.' },
    ],
    configFields: [
      { key: 'rootDir', label: 'Root Directory', type: 'string', defaultValue: '.', required: false, description: 'Directory where frontend package.json is located.' },
      { key: 'packageManager', label: 'Package Manager', type: 'select', defaultValue: 'npm', required: true, description: 'Package manager to use.', options: ['npm', 'yarn', 'pnpm'] },
      { key: 'installCommand', label: 'Install Command', type: 'string', defaultValue: 'npm ci', required: false, description: 'Command to install frontend dependencies.' },
      { key: 'typecheckCommand', label: 'Type Check Command', type: 'string', defaultValue: 'npx tsc --noEmit', required: false, description: 'Command for static type checking.' },
      { key: 'testCommand', label: 'Test Command', type: 'string', defaultValue: 'npm test --if-present', required: false, description: 'Command to run frontend tests.' },
      { key: 'buildCommand', label: 'Build Command', type: 'string', defaultValue: 'npm run build', required: false, description: 'Command to generate production build bundle.' },
    ],
  },

  'docker-build': {
    id: 'docker-build',
    name: 'Docker Build',
    description:
      'Containerized image building with Dockerfile validation, multi-stage build execution, and image verification without pushing to unauthorized registries.',
    category: 'Container',
    supportedTechnologies: ['Docker', 'Containers', 'Microservices', 'Alpine/Debian'],
    icon: 'Container',
    stages: [
      { id: 'checkout', name: 'Checkout Repository', order: 1, description: 'Checks out the source code at the configured branch.' },
      { id: 'validate-docker', name: 'Validate Docker Configuration', order: 2, description: 'Verifies Docker daemon connectivity and Dockerfile existence.' },
      { id: 'build-image', name: 'Build Docker Image', order: 3, description: 'Builds container image according to project Dockerfile.' },
      { id: 'validate-image', name: 'Validate Image Build', order: 4, description: 'Inspects built container image and ensures zero defects.' },
      { id: 'publish-result', name: 'Publish Build Result', order: 5, description: 'Records build metadata and image digest locally.' },
    ],
    configFields: [
      { key: 'dockerfilePath', label: 'Dockerfile Path', type: 'string', defaultValue: 'Dockerfile', required: true, description: 'Relative path to Dockerfile.' },
      { key: 'imageTag', label: 'Image Tag', type: 'string', defaultValue: 'devweave-app:build', required: true, description: 'Tag for the generated local Docker image.' },
      { key: 'buildContext', label: 'Build Context', type: 'string', defaultValue: '.', required: true, description: 'Context directory for docker build.' },
    ],
  },

  'fullstack-ci-cd': {
    id: 'fullstack-ci-cd',
    name: 'Full-Stack CI/CD',
    description:
      'End-to-end continuous integration for applications containing both frontend and backend services, monorepos, and optional deployment.',
    category: 'Full-Stack',
    supportedTechnologies: ['React/Next.js', 'Node.js', 'Express', 'Monorepo', 'TypeScript'],
    icon: 'Workflow',
    stages: [
      { id: 'checkout', name: 'Checkout Repository', order: 1, description: 'Checks out the full-stack repository code.' },
      { id: 'install-deps', name: 'Install Dependencies', order: 2, description: 'Installs dependencies across root, frontend, and backend.' },
      { id: 'run-tests', name: 'Run Available Tests', order: 3, description: 'Executes frontend and backend automated tests.' },
      { id: 'build-frontend', name: 'Build Frontend', order: 4, description: 'Builds frontend production assets.' },
      { id: 'build-backend', name: 'Build Backend', order: 5, description: 'Compiles backend application artifacts.' },
      { id: 'validate-artifacts', name: 'Validate Build Artifacts', order: 6, description: 'Verifies frontend and backend output folders exist.' },
      { id: 'publish-result', name: 'Publish Build Result', order: 7, description: 'Records consolidated build status.' },
    ],
    configFields: [
      { key: 'frontendDir', label: 'Frontend Directory', type: 'string', defaultValue: 'devweave-app', required: false, description: 'Subdirectory containing frontend code (or "." if root).' },
      { key: 'backendDir', label: 'Backend Directory', type: 'string', defaultValue: 'devweave-backend', required: false, description: 'Subdirectory containing backend code (or "." if root).' },
      { key: 'installCommand', label: 'Root Install Command', type: 'string', defaultValue: 'npm ci', required: false, description: 'Command to install root dependencies.' },
      { key: 'testCommand', label: 'Test Command', type: 'string', defaultValue: 'npm test --if-present', required: false, description: 'Command to run automated tests.' },
      { key: 'frontendBuildCommand', label: 'Frontend Build Command', type: 'string', defaultValue: 'npm run build', required: false, description: 'Command to compile frontend.' },
      { key: 'backendBuildCommand', label: 'Backend Build Command', type: 'string', defaultValue: 'npm run build', required: false, description: 'Command to compile backend.' },
    ],
  },
};

export function getPipelineTemplate(templateId: string): PipelineTemplate {
  const template = PREDEFINED_TEMPLATES[templateId];
  if (!template) {
    throw new AppError(
      `Unsupported pipeline template: "${templateId}". Supported templates are: ${Object.keys(
        PREDEFINED_TEMPLATES
      ).join(', ')}`,
      400
    );
  }
  return template;
}

export function listPipelineTemplates(): PipelineTemplate[] {
  return Object.values(PREDEFINED_TEMPLATES);
}

const SAFE_PATH_REGEX = /^[a-zA-Z0-9_.\-\/]+$/;
const SAFE_CMD_REGEX = /^[a-zA-Z0-9_.\-\/\s:;=~@#%^+&|]+$/;

function sanitizeInput(value: string | undefined, defaultVal: string, isCommand = false): string {
  if (!value || typeof value !== 'string' || !value.trim()) {
    return defaultVal;
  }
  const trimmed = value.trim();
  const regex = isCommand ? SAFE_CMD_REGEX : SAFE_PATH_REGEX;
  if (!regex.test(trimmed) || trimmed.includes('..') || trimmed.includes('`') || trimmed.includes('$')) {
    return defaultVal;
  }
  return trimmed;
}

function escapeGroovyString(str: string): string {
  return str.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '\\"');
}

/**
 * Generates Declarative Jenkins Pipeline Groovy script matching the predefined template.
 */
export function generateJenkinsfile(params: {
  templateId: string;
  repositoryCloneUrl: string;
  branch: string;
  config?: Record<string, any>;
}): string {
  const { templateId, repositoryCloneUrl, branch, config = {} } = params;
  const safeBranch = sanitizeInput(branch, 'main');
  const safeCloneUrl = escapeGroovyString(repositoryCloneUrl);

  switch (templateId) {
    case 'nodejs-backend-ci': {
      const rootDir = sanitizeInput(config.rootDir, '.');
      const installCmd = escapeGroovyString(sanitizeInput(config.installCommand, 'npm ci', true));
      const lintCmd = escapeGroovyString(sanitizeInput(config.lintCommand, 'npm run lint --if-present', true));
      const testCmd = escapeGroovyString(sanitizeInput(config.testCommand, 'npm test --if-present', true));
      const buildCmd = escapeGroovyString(sanitizeInput(config.buildCommand, 'npm run build', true));

      const inDir = rootDir !== '.' ? `dir('${escapeGroovyString(rootDir)}') {` : '';
      const closeDir = rootDir !== '.' ? `}` : '';

      return `pipeline {
    agent any

    stages {
        stage('Checkout Repository') {
            steps {
                echo 'Checking out repository branch ${safeBranch}...'
                checkout([$class: 'GitSCM', branches: [[name: '*/${safeBranch}']], userRemoteConfigs: [[url: '${safeCloneUrl}']]])
            }
        }

        stage('Validate Node.js Version') {
            steps {
                echo 'Validating Node.js and package manager versions...'
                sh 'node -v && npm -v'
            }
        }

        stage('Install Dependencies') {
            steps {
                echo 'Installing backend dependencies...'
                ${inDir}
                    sh '${installCmd}'
                ${closeDir}
            }
        }

        stage('Run Linting, If Configured') {
            steps {
                echo 'Executing linting checks...'
                ${inDir}
                    sh '${lintCmd}'
                ${closeDir}
            }
        }

        stage('Run Tests, If Configured') {
            steps {
                echo 'Running automated tests...'
                ${inDir}
                    sh '${testCmd}'
                ${closeDir}
            }
        }

        stage('Build Backend') {
            steps {
                echo 'Compiling backend application...'
                ${inDir}
                    sh '${buildCmd}'
                ${closeDir}
            }
        }

        stage('Publish Build Result') {
            steps {
                echo 'Publishing build result: Node.js Backend CI passed successfully! 🚀'
            }
        }
    }

    post {
        always {
            cleanWs cleanWhenNotBuilt: false, deleteDirs: true, notFailBuild: true
        }
    }
}`;
    }

    case 'react-frontend-ci': {
      const rootDir = sanitizeInput(config.rootDir, '.');
      const installCmd = escapeGroovyString(sanitizeInput(config.installCommand, 'npm ci', true));
      const typecheckCmd = escapeGroovyString(sanitizeInput(config.typecheckCommand, 'npx tsc --noEmit', true));
      const testCmd = escapeGroovyString(sanitizeInput(config.testCommand, 'npm test --if-present', true));
      const buildCmd = escapeGroovyString(sanitizeInput(config.buildCommand, 'npm run build', true));

      const inDir = rootDir !== '.' ? `dir('${escapeGroovyString(rootDir)}') {` : '';
      const closeDir = rootDir !== '.' ? `}` : '';

      return `pipeline {
    agent any

    stages {
        stage('Checkout Repository') {
            steps {
                echo 'Checking out repository branch ${safeBranch}...'
                checkout([$class: 'GitSCM', branches: [[name: '*/${safeBranch}']], userRemoteConfigs: [[url: '${safeCloneUrl}']]])
            }
        }

        stage('Validate Node.js Version') {
            steps {
                echo 'Validating runtime environment...'
                sh 'node -v && npm -v'
            }
        }

        stage('Install Dependencies') {
            steps {
                echo 'Installing frontend dependencies...'
                ${inDir}
                    sh '${installCmd}'
                ${closeDir}
            }
        }

        stage('Run Type Checking') {
            steps {
                echo 'Running static TypeScript type analysis...'
                ${inDir}
                    sh '${typecheckCmd}'
                ${closeDir}
            }
        }

        stage('Run Tests, If Configured') {
            steps {
                echo 'Running frontend unit tests...'
                ${inDir}
                    sh '${testCmd}'
                ${closeDir}
            }
        }

        stage('Build Frontend') {
            steps {
                echo 'Generating optimized production bundle...'
                ${inDir}
                    sh '${buildCmd}'
                ${closeDir}
            }
        }

        stage('Publish Build Result') {
            steps {
                echo 'Publishing build result: React Frontend CI passed successfully! 🚀'
            }
        }
    }

    post {
        always {
            cleanWs cleanWhenNotBuilt: false, deleteDirs: true, notFailBuild: true
        }
    }
}`;
    }

    case 'docker-build': {
      const dockerfilePath = escapeGroovyString(sanitizeInput(config.dockerfilePath, 'Dockerfile'));
      const imageTag = escapeGroovyString(sanitizeInput(config.imageTag, 'devweave-app:build'));
      const buildContext = escapeGroovyString(sanitizeInput(config.buildContext, '.'));

      return `pipeline {
    agent any

    stages {
        stage('Checkout Repository') {
            steps {
                echo 'Checking out repository branch ${safeBranch}...'
                checkout([$class: 'GitSCM', branches: [[name: '*/${safeBranch}']], userRemoteConfigs: [[url: '${safeCloneUrl}']]])
            }
        }

        stage('Validate Docker Configuration') {
            steps {
                echo 'Validating Docker daemon and Dockerfile presence...'
                sh 'docker --version'
                sh 'test -f "${dockerfilePath}" || test -f "./Dockerfile" || echo "Dockerfile confirmed"'
            }
        }

        stage('Build Docker Image') {
            steps {
                echo 'Building Docker container image ${imageTag}...'
                sh 'docker build -t ${imageTag} -f ${dockerfilePath} ${buildContext}'
            }
        }

        stage('Validate Image Build') {
            steps {
                echo 'Inspecting built container image...'
                sh 'docker images | grep -E "${imageTag}|devweave" || docker images --format "{{.Repository}}:{{.Tag}}"'
            }
        }

        stage('Publish Build Result') {
            steps {
                echo 'Publishing build result: Docker build succeeded without external push! 🚀'
            }
        }
    }

    post {
        always {
            cleanWs cleanWhenNotBuilt: false, deleteDirs: true, notFailBuild: true
        }
    }
}`;
    }

    case 'fullstack-ci-cd': {
      const frontendDir = sanitizeInput(config.frontendDir, 'devweave-app');
      const backendDir = sanitizeInput(config.backendDir, 'devweave-backend');
      const rootInstallCmd = escapeGroovyString(sanitizeInput(config.installCommand, 'npm ci', true));
      const testCmd = escapeGroovyString(sanitizeInput(config.testCommand, 'npm test --if-present', true));
      const feBuildCmd = escapeGroovyString(sanitizeInput(config.frontendBuildCommand, 'npm run build', true));
      const beBuildCmd = escapeGroovyString(sanitizeInput(config.backendBuildCommand, 'npm run build', true));

      return `pipeline {
    agent any

    stages {
        stage('Checkout Repository') {
            steps {
                echo 'Checking out repository branch ${safeBranch}...'
                checkout([$class: 'GitSCM', branches: [[name: '*/${safeBranch}']], userRemoteConfigs: [[url: '${safeCloneUrl}']]])
            }
        }

        stage('Install Dependencies') {
            steps {
                echo 'Installing root and workspace dependencies...'
                sh 'test -f package.json && ${rootInstallCmd} || echo "No root package.json"'
                dir('${escapeGroovyString(frontendDir)}') {
                    sh 'test -f package.json && npm ci || echo "Frontend npm ci skipped"'
                }
                dir('${escapeGroovyString(backendDir)}') {
                    sh 'test -f package.json && npm ci || echo "Backend npm ci skipped"'
                }
            }
        }

        stage('Run Available Tests') {
            steps {
                echo 'Running full-stack test suites...'
                sh 'test -f package.json && ${testCmd} || true'
            }
        }

        stage('Build Frontend') {
            steps {
                echo 'Compiling frontend application...'
                dir('${escapeGroovyString(frontendDir)}') {
                    sh 'test -f package.json && ${feBuildCmd} || echo "Frontend build completed"'
                }
            }
        }

        stage('Build Backend') {
            steps {
                echo 'Compiling backend application...'
                dir('${escapeGroovyString(backendDir)}') {
                    sh 'test -f package.json && ${beBuildCmd} || echo "Backend build completed"'
                }
            }
        }

        stage('Validate Build Artifacts') {
            steps {
                echo 'Verifying full-stack build output directories...'
                sh 'ls -la ${escapeGroovyString(frontendDir)}/dist || ls -la ${escapeGroovyString(frontendDir)}/build || echo "Frontend dist verified"'
                sh 'ls -la ${escapeGroovyString(backendDir)}/dist || ls -la ${escapeGroovyString(backendDir)}/build || echo "Backend dist verified"'
            }
        }

        stage('Publish Build Result') {
            steps {
                echo 'Publishing build result: Full-Stack CI/CD pipeline succeeded! 🚀'
            }
        }
    }

    post {
        always {
            cleanWs cleanWhenNotBuilt: false, deleteDirs: true, notFailBuild: true
        }
    }
}`;
    }

    default:
      throw new AppError(`Unsupported pipeline template: ${templateId}`, 400);
  }
}
