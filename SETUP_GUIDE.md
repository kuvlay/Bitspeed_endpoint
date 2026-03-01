# Bitespeed Learning + Setup Guide (Node + Express + Prisma + Neon)

This file is both:

- a setup checklist
- a beginner execution order (what file to create first, why, and how files connect)

---

## 0. Mental model before coding

Think in 4 layers:

1. Entry layer: receives HTTP requests (`src/index.ts`)
2. Route layer: validates request and calls logic (`src/routes/identify.ts`)
3. Business layer: reconciliation algorithm (`src/lib/reconcile.ts`)
4. Data layer: DB connection + schema (`src/lib/prisma.ts`, `prisma/schema.prisma`)

Rule: each layer should do one job only.

---

## 1. Prerequisites

- Node.js 20+
- npm 10+
- Git

Check:

```bash
node -v
npm -v
git --version
```

---

## 2. Install dependencies

If this repo already has `package.json`, run:

```bash
npm install
```

If starting from scratch:

```bash
npm i express zod @prisma/client
npm i -D typescript ts-node-dev prisma @types/node @types/express
```

---

## 3. Neon setup (first time)

### 3.1 Create project

1. Login to Neon dashboard.
2. Click `New Project`.
3. Pick a name and nearest region.
4. Keep default Postgres version and create.

### 3.2 Copy connection string

1. Open project `Connect` or `Connection Details`.
2. Choose database/user (defaults are fine).
3. Copy Prisma/Postgres URL.

Example:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST/DBNAME?sslmode=require"
```

### 3.3 Save in `.env`

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST/DBNAME?sslmode=require"
PORT=3000
```

Important:

- keep `sslmode=require`
- do not commit `.env`

---

## 4. Define database schema first (SQL-first workflow)

Why first: your route and logic depend on real table columns.

Update `prisma/schema.prisma` with:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum LinkPrecedence {
  primary
  secondary
}

model Contact {
  id             Int            @id @default(autoincrement())
  phoneNumber    String?        @db.VarChar(32)
  email          String?        @db.VarChar(255)
  linkedId       Int?
  linkPrecedence LinkPrecedence @default(primary)
  createdAt      DateTime       @default(now())
  updatedAt      DateTime       @updatedAt
  deletedAt      DateTime?

  primary     Contact?  @relation("ContactToContact", fields: [linkedId], references: [id])
  secondaries Contact[] @relation("ContactToContact")

  @@index([email])
  @@index([phoneNumber])
  @@index([linkedId])
}
```

Then run:

```bash
npm run prisma:generate
npm run prisma:migrate -- --name init_contact
```

---

## 5. Create files in this exact order

This prevents confusion.

1. `src/lib/prisma.ts`
2. `src/types/api.ts`
3. `src/lib/reconcile.ts` (stub first, real logic later)
4. `src/routes/identify.ts`
5. `src/index.ts`

Create folders:

```bash
mkdir src
mkdir src\lib
mkdir src\routes
mkdir src\types
```

### 5.1 `src/lib/prisma.ts` (data access entry)

```ts
import { PrismaClient } from "@prisma/client";
export const prisma = new PrismaClient();
```

### 5.2 `src/types/api.ts` (shared request/response types)

```ts
export type IdentifyInput = {
  email: string | null;
  phoneNumber: string | null;
};

export type IdentifyResponse = {
  primaryContatctId: number;
  emails: string[];
  phoneNumbers: string[];
  secondaryContactIds: number[];
};
```

### 5.3 `src/lib/reconcile.ts` (business logic)

Start with a stub so server can boot:

```ts
import type { IdentifyInput, IdentifyResponse } from "../types/api";

export async function reconcileIdentity(_input: IdentifyInput): Promise<IdentifyResponse> {
  return {
    primaryContatctId: 0,
    emails: [],
    phoneNumbers: [],
    secondaryContactIds: [],
  };
}
```

### 5.4 `src/routes/identify.ts` (validate + call service)

- validate input with Zod
- normalize email/phone
- call `reconcileIdentity`
- return JSON

### 5.5 `src/index.ts` (app bootstrap)

- create express app
- add `express.json()`
- register `/health`
- mount `/identify`
- global error middleware
- start server

---

## 6. How files link together (import flow)

Request flow:

1. client calls `POST /identify`
2. `src/index.ts` forwards to `identifyRouter`
3. `src/routes/identify.ts` validates and calls `reconcileIdentity(...)`
4. `src/lib/reconcile.ts` uses `prisma` from `src/lib/prisma.ts`
5. response goes back through route to client

Import graph:

- `index.ts` -> `routes/identify.ts`
- `routes/identify.ts` -> `lib/reconcile.ts`
- `lib/reconcile.ts` -> `lib/prisma.ts` and `types/api.ts`

---

## 7. Compare with your Next.js + NoSQL mental model

Typical Next + NoSQL:

- `app/api/identify/route.ts` contains validation + logic + DB calls all together
- DB is often schema-lite
- TS interfaces mostly app-level typing

This Express + SQL approach:

- route and logic are separated
- DB schema is explicit and migrated
- Prisma model is source of truth for table design

Quick mapping:

- Next API route file -> `src/routes/identify.ts`
- service/util file -> `src/lib/reconcile.ts`
- db client util -> `src/lib/prisma.ts`
- interface/type file -> `src/types/api.ts`
- NoSQL collection shape -> Prisma `model Contact` + migration

---

## 8. First successful run

After creating files:

```bash
npm run dev
```

Check:

```bash
curl http://localhost:3000/health
```

Expected:

```json
{"ok":true}
```

---

## 9. Implement reconciliation after server boots

Do not write full algorithm in one shot. Build in steps:

1. Seed lookup by email/phone
2. No seed -> create primary
3. Seed exists -> resolve primary IDs
4. Choose oldest winner
5. Merge other primaries
6. Insert secondary only for new info
7. Build final consolidated response

Commit after each step.

---

## 10. Manual test commands

```bash
curl -X POST http://localhost:3000/identify -H "Content-Type: application/json" -d "{\"email\":\"a@x.com\",\"phoneNumber\":\"111\"}"
curl -X POST http://localhost:3000/identify -H "Content-Type: application/json" -d "{\"email\":\"b@x.com\",\"phoneNumber\":\"111\"}"
curl -X POST http://localhost:3000/identify -H "Content-Type: application/json" -d "{\"email\":\"c@x.com\",\"phoneNumber\":\"222\"}"
curl -X POST http://localhost:3000/identify -H "Content-Type: application/json" -d "{\"email\":\"a@x.com\",\"phoneNumber\":\"222\"}"
```

---

## 11. Common issues

- Red warning on `url = env("DATABASE_URL")`
  - `DATABASE_URL` missing in `.env`, or invalid URL format.

- `npm run dev` fails with missing file
  - create files from section 5 in order.

- Prisma migration fails
  - confirm Neon URL and credentials.
  - keep SSL in URL.

---

## 12. Daily workflow

```bash
npm run dev
npm run prisma:studio
```

After schema changes:

```bash
npm run prisma:migrate -- --name <change_name>
npm run prisma:generate
```

Before push:

```bash
git status
git add .
git commit -m "feat: <small change>"
git push
```
