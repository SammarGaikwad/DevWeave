import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface DockerStatus {
  installed: boolean;
  cliVersion: string | null;
  daemonRunning: boolean;
  serverVersion: string | null;
  containersRunning?: number;
  containersTotal?: number;
  imagesTotal?: number;
  status: 'CONNECTED' | 'DAEMON_OFFLINE' | 'NOT_INSTALLED';
  message: string;
  setupInstructions: string[];
}

export interface DockerTemplate {
  id: string;
  name: string;
  language: string;
  category: string;
  description: string;
  defaultPort: number;
  content: string;
  composeSnippet: string;
  bestPractices: string[];
}

export const DOCKER_TEMPLATES: Record<string, DockerTemplate> = {
  'nodejs-express': {
    id: 'nodejs-express',
    name: 'Node.js Express / TypeScript (Multi-Stage)',
    language: 'TypeScript / JavaScript',
    category: 'Backend',
    description: 'Production-ready multi-stage build with non-root execution, cache-mounted installs, and minimal runtime footprint.',
    defaultPort: 8080,
    content: `# Build Stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build --if-present

# Production Stage
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -S devweave && adduser -S devweave -G devweave
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=builder /app/dist ./dist
USER devweave
EXPOSE 8080
CMD ["node", "dist/server.js"]`,
    composeSnippet: `  backend:
    build:
      context: ./devweave-backend
      dockerfile: Dockerfile
    ports:
      - "8080:8080"
    environment:
      - NODE_ENV=production
      - PORT=8080
    restart: unless-stopped`,
    bestPractices: [
      'Multi-stage builds eliminate compiler and devDependencies from final image',
      'Runs as unprivileged user "devweave" instead of root',
      'Uses Alpine Linux base for reduced attack surface (<180MB)',
    ],
  },

  'react-vite': {
    id: 'react-vite',
    name: 'React Vite Single-Page Application (Nginx)',
    language: 'TypeScript / React',
    category: 'Frontend',
    description: 'Ultra-fast Vite build served via high-performance Nginx Alpine with client-side SPA routing rules.',
    defaultPort: 80,
    content: `# Build Stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Nginx Web Server Stage
FROM nginx:alpine-slim AS runner
COPY --from=builder /app/dist /usr/share/nginx/html
# Nginx SPA fallback configuration
RUN echo 'server { \
    listen 80; \
    server_name localhost; \
    location / { \
        root /usr/share/nginx/html; \
        index index.html index.htm; \
        try_files $uri $uri/ /index.html; \
    } \
}' > /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]`,
    composeSnippet: `  frontend:
    build:
      context: ./devweave-app
      dockerfile: Dockerfile
    ports:
      - "3000:80"
    restart: unless-stopped`,
    bestPractices: [
      'SPA history API fallback configured in Nginx default.conf',
      'Static assets served from nginx:alpine-slim (<25MB image size)',
      'Immutable browser caching ready for production deployments',
    ],
  },

  'python-fastapi': {
    id: 'python-fastapi',
    name: 'Python FastAPI / Flask Microservice',
    language: 'Python',
    category: 'Backend',
    description: 'Python 3.12 slim container with virtualenv isolation, unprivileged user, and uvicorn ASGI server.',
    defaultPort: 8000,
    content: `# Python Production Runtime
FROM python:3.12-slim AS runner
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 \\
    PYTHONUNBUFFERED=1 \\
    PIP_NO_CACHE_DIR=1

RUN groupadd -r devweave && useradd -r -g devweave devweave
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
USER devweave
EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]`,
    composeSnippet: `  api:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "8000:8000"
    restart: unless-stopped`,
    bestPractices: [
      'PYTHONDONTWRITEBYTECODE=1 avoids writing .pyc files to container disk',
      'PYTHONUNBUFFERED=1 ensures real-time stdout/stderr log streaming',
      'Non-root user devweave prevents container breakout vulnerability',
    ],
  },

  'go-api': {
    id: 'go-api',
    name: 'Go High-Performance API (Scratch / Distroless)',
    language: 'Go',
    category: 'Backend',
    description: 'Compiles statically linked binary with CGO_ENABLED=0 running inside distroless minimal container.',
    defaultPort: 8080,
    content: `# Compile Binary Stage
FROM golang:1.22-alpine AS builder
WORKDIR /app
RUN apk add --no-cache git ca-certificates
COPY go.mod go.sum* ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -ldflags="-w -s" -o /app/server .

# Minimal Runtime Stage
FROM gcr.io/distroless/static-debian12:nonroot
WORKDIR /
COPY --from=builder /app/server /server
USER nonroot:nonroot
EXPOSE 8080
ENTRYPOINT ["/server"]`,
    composeSnippet: `  go-service:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "8080:8080"
    restart: unless-stopped`,
    bestPractices: [
      'Statically compiled Go binary produces ultra-minimal image (<20MB)',
      'Distroless base contains no shell, curl, or package manager, preventing RCE exploits',
      'Linker flags -w -s strip debugging symbols and reduce payload size',
    ],
  },

  'java-springboot': {
    id: 'java-springboot',
    name: 'Java Spring Boot (Eclipse Temurin 21 Layered)',
    language: 'Java',
    category: 'Backend',
    description: 'Multi-stage Gradle/Maven build using Spring Boot layered jars for fast container caching.',
    defaultPort: 8080,
    content: `# Build Stage
FROM eclipse-temurin:21-jdk-alpine AS builder
WORKDIR /workspace
COPY gradlew build.gradle settings.gradle ./
COPY gradle gradle
RUN ./gradlew dependencies --no-daemon
COPY src src
RUN ./gradlew bootJar -x test --no-daemon

# Extraction Stage for Layered Caching
FROM eclipse-temurin:21-jre-alpine AS layers
WORKDIR /workspace
COPY --from=builder /workspace/build/libs/*.jar app.jar
RUN java -Djarmode=layertools -jar app.jar extract

# Production Runner
FROM eclipse-temurin:21-jre-alpine AS runner
WORKDIR /app
RUN addgroup -S devweave && adduser -S devweave -G devweave
COPY --from=layers /workspace/dependencies/ ./
COPY --from=layers /workspace/spring-boot-loader/ ./
COPY --from=layers /workspace/snapshot-dependencies/ ./
COPY --from=layers /workspace/application/ ./
USER devweave
EXPOSE 8080
ENTRYPOINT ["java", "org.springframework.boot.loader.launch.JarLauncher"]`,
    composeSnippet: `  spring-app:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "8080:8080"
    restart: unless-stopped`,
    bestPractices: [
      'Spring Boot jar layers enable sub-second rebuild cache hits for application classes',
      'Uses official Eclipse Temurin JRE runtime rather than bloated full JDK',
    ],
  },
};

export async function checkDockerStatus(): Promise<DockerStatus> {
  let cliVersion: string | null = null;

  try {
    const { stdout } = await execAsync('docker --version', { timeout: 2000 });
    cliVersion = stdout.trim();
  } catch {
    return {
      installed: false,
      cliVersion: null,
      daemonRunning: false,
      serverVersion: null,
      status: 'NOT_INSTALLED',
      message: 'Docker CLI was not detected in PATH.',
      setupInstructions: [
        'Download and install Docker Desktop for Windows from https://www.docker.com/products/docker-desktop',
        'Ensure WSL 2 backend or Hyper-V feature is enabled',
        'Verify docker is available in PowerShell: docker --version',
      ],
    };
  }

  try {
    const { stdout } = await execAsync('docker info --format "{{.ServerVersion}}|{{.ContainersRunning}}|{{.Containers}}|{{.Images}}"', { timeout: 2500 });
    const parts = stdout.trim().split('|');
    const serverVersion = parts[0] || 'Unknown';
    const containersRunning = parseInt(parts[1] || '0', 10);
    const containersTotal = parseInt(parts[2] || '0', 10);
    const imagesTotal = parseInt(parts[3] || '0', 10);

    return {
      installed: true,
      cliVersion,
      daemonRunning: true,
      serverVersion,
      containersRunning: isNaN(containersRunning) ? 0 : containersRunning,
      containersTotal: isNaN(containersTotal) ? 0 : containersTotal,
      imagesTotal: isNaN(imagesTotal) ? 0 : imagesTotal,
      status: 'CONNECTED',
      message: `Docker Engine ${serverVersion} is connected and ready for container operations.`,
      setupInstructions: [],
    };
  } catch {
    return {
      installed: true,
      cliVersion,
      daemonRunning: false,
      serverVersion: null,
      status: 'DAEMON_OFFLINE',
      message: 'Docker CLI is installed, but Docker Desktop or daemon service is not currently running.',
      setupInstructions: [
        'Launch "Docker Desktop" from Windows Start menu or desktop shortcut',
        'Wait for the Docker icon in the Windows taskbar system tray to show "Docker is running"',
        'If running inside WSL or Linux VM, start the service with: sudo systemctl start docker',
        'Ensure user is added to the docker group: sudo usermod -aG docker $USER',
      ],
    };
  }
}
