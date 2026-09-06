# DevWeave Backend

DevWeave Internal Developer Platform Backend (Node.js + TypeScript + Express + PostgreSQL + Prisma).

## Features
- **Node.js & Express**: High-performance TypeScript REST API foundation.
- **Prisma ORM & PostgreSQL**: Scalable relational schema management and migrations.
- **Zod Environment & Request Validation**: Strict type-safe schema validation.
- **Security & Logging**: Helmet headers, CORS policies, bcrypt password hashing, and HTTP request logging.

## Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Setup
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

### 3. Database Migration & Prisma Generation
```bash
npm run prisma:generate
npm run prisma:migrate
```

### 4. Development Server
```bash
npm run dev
```

### 5. Typecheck & Build
```bash
npm run typecheck
npm run build
```
