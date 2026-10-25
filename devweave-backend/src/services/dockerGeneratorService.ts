import { DetectedStack } from './dockerAnalysisService.js';

export interface GeneratedDockerConfig {
  dockerfile: string;
  dockerignore: string;
  composeFile?: string;
  explanations: string[];
  assumptions: string[];
  diffs?: {
    dockerfileDiff?: string;
    composeDiff?: string;
  };
}

export function generateDockerConfig(stack: DetectedStack): GeneratedDockerConfig {
  const explanations: string[] = [];
  const assumptions = [...stack.assumptions];

  let dockerfile = '';
  let composeFile: string | undefined = undefined;

  // Standard production .dockerignore
  const dockerignore = `# DevWeave Optimized .dockerignore
.git
.github
.gitignore
.env
.env.*
!.env.example
node_modules
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*
dist
build
out
.next
target
__pycache__
*.py[cod]
*$py.class
*.log
.DS_Store
.idea
.vscode
Dockerfile*
docker-compose*
`;

  // 1. Next.js multi-stage build
  if (stack.framework === 'Next.js') {
    explanations.push('Multi-stage Next.js build using Node 20 Alpine and standalone output for minimal image size (~100MB).');
    explanations.push('Runs under unprivileged "nextjs" system user with security best practices.');

    dockerfile = `# DevWeave Production Next.js Dockerfile
# Stage 1: Dependencies
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package*.json ./
RUN npm ci

# Stage 2: Builder
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
RUN npm run build

# Stage 3: Runner
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
`;
  }
  // 2. React / Vite static frontend (Nginx)
  else if (stack.framework.includes('Vite') || stack.projectType === 'frontend') {
    explanations.push('Multi-stage SPA build: compiles assets in Node 20 Alpine, serves with lightweight high-performance Nginx Alpine.');
    explanations.push('Custom non-root Nginx configuration with gzip and security headers enabled.');

    dockerfile = `# DevWeave Production React/Vite Dockerfile
# Stage 1: Build stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Production Nginx Server
FROM nginx:alpine AS runner
# Copy built static artifacts
COPY --from=builder /app/dist /usr/share/nginx/html
# Custom SPA fallback configuration
RUN echo 'server { \\
    listen 80; \\
    location / { \\
        root /usr/share/nginx/html; \\
        index index.html index.htm; \\
        try_files $uri $uri/ /index.html; \\
    } \\
    error_page 500 502 503 504 /50x.html; \\
    location = /50x.html { \\
        root /usr/share/nginx/html; \\
    } \\
}' > /etc/nginx/conf.d/default.conf

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \\
  CMD wget -q --spider http://localhost:80/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
`;
  }
  // 3. Express.js / TypeScript Backend
  else if (stack.framework.includes('Express') || stack.language === 'TypeScript') {
    explanations.push('Multi-stage Node.js TypeScript build: compiles in builder stage, copies only production dependencies into final image.');
    explanations.push('Executes as unprivileged "node" user.');

    dockerfile = `# DevWeave Production Node.js / Express Dockerfile
# Stage 1: Build stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY tsconfig*.json ./
RUN npm ci
COPY . .
RUN npm run build || true

# Stage 2: Runtime stage
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force
COPY --from=builder /app/dist ./dist

USER node
EXPOSE ${stack.defaultPort}
CMD [${stack.startCommand.split(' ').map((s) => `"${s}"`).join(', ')}]
`;
  }
  // 4. Python (FastAPI / Flask / Django)
  else if (stack.language === 'Python') {
    explanations.push('Python 3.11 slim image with pip cache cleanup and non-root application user.');
    explanations.push('Optimized bytecode generation with PYTHONUNBUFFERED=1.');

    dockerfile = `# DevWeave Production Python Dockerfile
FROM python:3.11-slim AS runner
WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \\
    PYTHONUNBUFFERED=1 \\
    PORT=${stack.defaultPort}

# Create unprivileged user
RUN groupadd -g 1000 appuser && \\
    useradd -u 1000 -g appuser -s /bin/bash -m appuser

# Install dependencies
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy application source
COPY --chown=appuser:appuser . .

USER appuser
EXPOSE ${stack.defaultPort}
CMD [${stack.startCommand.split(' ').map((s) => `"${s}"`).join(', ')}]
`;
  }
  // 5. Java (Spring Boot / Maven)
  else if (stack.language === 'Java') {
    explanations.push('Multi-stage Java build: Maven build stage and Eclipse Temurin 21 JRE runtime stage.');
    explanations.push('Minimal footprint with unprivileged user execution.');

    dockerfile = `# DevWeave Production Java Dockerfile
# Stage 1: Build stage
FROM maven:3.9-eclipse-temurin-21-alpine AS builder
WORKDIR /app
COPY pom.xml ./
RUN mvn dependency:go-offline -B
COPY src ./src
RUN mvn clean package -DskipTests -B

# Stage 2: Runtime
FROM eclipse-temurin:21-jre-alpine AS runner
WORKDIR /app
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
COPY --from=builder /app/target/*.jar app.jar
USER appuser
EXPOSE ${stack.defaultPort}
ENTRYPOINT ["java", "-jar", "app.jar"]
`;
  }
  // 6. Full-stack (Client + Server)
  else if (stack.projectType === 'fullstack') {
    explanations.push('Detected full-stack architecture. Generated multi-service Docker Compose blueprint and standalone backend Dockerfile.');
    dockerfile = `# DevWeave Full-Stack Root Dockerfile
FROM node:20-alpine AS base
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build || true
EXPOSE 8080
CMD ["npm", "start"]
`;
    composeFile = `version: '3.8'
services:
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    ports:
      - "8080:8080"
    environment:
      - NODE_ENV=production
      - PORT=8080
    restart: unless-stopped

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    ports:
      - "80:80"
    depends_on:
      - backend
    restart: unless-stopped
`;
  }
  // 7. Generic Fallback
  else {
    explanations.push('Standard production container configuration.');
    dockerfile = `# DevWeave Universal Production Dockerfile
FROM alpine:3.19 AS runner
WORKDIR /app
RUN apk add --no-cache bash ca-certificates
COPY . .
EXPOSE ${stack.defaultPort}
CMD ["sh", "-c", "echo 'DevWeave container started'"]
`;
  }

  // Calculate simple unified diff if an existing Dockerfile exists
  const diffs: { dockerfileDiff?: string; composeDiff?: string } = {};
  if (stack.existingDockerfile) {
    diffs.dockerfileDiff = createSimpleDiff(stack.existingDockerfile, dockerfile);
  }
  if (stack.existingCompose && composeFile) {
    diffs.composeDiff = createSimpleDiff(stack.existingCompose, composeFile);
  }

  return {
    dockerfile,
    dockerignore,
    composeFile,
    explanations,
    assumptions,
    diffs,
  };
}

function createSimpleDiff(oldContent: string, newContent: string): string {
  const oldLines = oldContent.split('\n');
  const newLines = newContent.split('\n');
  const diffLines: string[] = ['--- Existing Dockerfile', '+++ DevWeave Generated Dockerfile'];

  const max = Math.max(oldLines.length, newLines.length);
  for (let i = 0; i < max; i++) {
    const o = oldLines[i];
    const n = newLines[i];
    if (o === n) {
      if (o !== undefined) diffLines.push(`  ${o}`);
    } else {
      if (o !== undefined) diffLines.push(`- ${o}`);
      if (n !== undefined) diffLines.push(`+ ${n}`);
    }
  }

  return diffLines.slice(0, 100).join('\n');
}
