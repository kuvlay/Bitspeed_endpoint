# Reading Comprehension: Full Project Walkthrough

A source-reading guide to request validation, contact reconciliation, and PostgreSQL persistence. Links are relative to this repository; line numbers can shift as the code evolves.

## 1) Project map

1. [src/index.ts](src/index.ts)
2. [src/routes/identify.ts](src/routes/identify.ts)
3. [src/lib/reconcile.ts](src/lib/reconcile.ts)
4. [src/lib/prisma.ts](src/lib/prisma.ts)
5. [src/types/api.ts](src/types/api.ts)
6. [prisma/schema.prisma](prisma/schema.prisma)
7. [prisma/migrations/20260301120000_init_contact/migration.sql](prisma/migrations/20260301120000_init_contact/migration.sql)

## 2) Entry flow in plain English

1. Server starts in `src/index.ts`.
2. `POST /identify` requests go to `src/routes/identify.ts`.
3. Route validates and normalizes input.
4. Route calls `reconcileIdentity(...)` in `src/lib/reconcile.ts`.
5. Reconcile logic reads/writes contacts in DB using Prisma.
6. Route returns final response JSON.

## 3) File-by-file understanding

## 3.1 `src/index.ts` (bootstraps Express app)

Important lines:
1. [src/index.ts:1](src/index.ts#L1)
2. [src/index.ts:8](src/index.ts#L8)
3. [src/index.ts:10](src/index.ts#L10)
4. [src/index.ts:14](src/index.ts#L14)
5. [src/index.ts:16](src/index.ts#L16)
6. [src/index.ts:21](src/index.ts#L21)

What these lines do:
1. `import "dotenv/config";`
This loads `.env` into `process.env` so `DATABASE_URL` and `PORT` are available.
2. `app.use(express.json());`
This middleware parses JSON request bodies so `req.body` works.
3. `app.get("/health", ...)`
Simple check route to confirm server is alive.
4. `app.use("/identify", identifyRouter);`
Mounts your identify router. Any request to `/identify` enters that router.
5. Error middleware catches uncaught route errors and returns `500`.
6. `app.listen(...)` starts server on given port.

## 3.2 `src/routes/identify.ts` (API boundary)

Important lines:
1. [src/routes/identify.ts:6](src/routes/identify.ts#L6)
2. [src/routes/identify.ts:11](src/routes/identify.ts#L11)
3. [src/routes/identify.ts:15](src/routes/identify.ts#L15)
4. [src/routes/identify.ts:29](src/routes/identify.ts#L29)
5. [src/routes/identify.ts:31](src/routes/identify.ts#L31)
6. [src/routes/identify.ts:40](src/routes/identify.ts#L40)
7. [src/routes/identify.ts:43](src/routes/identify.ts#L43)

What these lines do:
1. `identifySchema` defines allowed input shape.
2. `.refine((data) => data.email || data.phoneNumber, ...)`
Extra rule: at least one field must exist.
3. `normalizeInput(...)` standardizes input:
`email -> lowercase`, `phoneNumber -> digits only`.
4. `identifyRouter.post("/", ...)` handles `POST /identify`.
5. `identifySchema.parse(req.body)` validates request. If invalid, throws `ZodError`.
6. `reconcileIdentity(normalized)` calls business logic.
7. If validation fails, returns `400` with details. The HTTP response maps the internal `primaryContactId` to the existing public key `primaryContatctId` (including that spelling).

Code snippet from route:
```ts
const parsed = identifySchema.parse(req.body);
const normalized = normalizeInput(parsed);
const result = await reconcileIdentity(normalized);
return res.status(200).json({
  contact: {
    primaryContatctId: result.primaryContactId,
    emails: result.emails,
    phoneNumbers: result.phoneNumbers,
    secondaryContactIds: result.secondaryContactIds,
  },
});
```

## 3.3 `src/lib/reconcile.ts` (core identity reconciliation)

This is the main algorithm.

Important lines:
1. [src/lib/reconcile.ts:87](src/lib/reconcile.ts#L87)
2. [src/lib/reconcile.ts:96](src/lib/reconcile.ts#L96)
3. [src/lib/reconcile.ts:108](src/lib/reconcile.ts#L108)
4. [src/lib/reconcile.ts:134](src/lib/reconcile.ts#L134)
5. [src/lib/reconcile.ts:146](src/lib/reconcile.ts#L146)
6. [src/lib/reconcile.ts:170](src/lib/reconcile.ts#L170)
7. [src/lib/reconcile.ts:183](src/lib/reconcile.ts#L183)

What these lines do:
1. Starts a DB transaction.
Every operation runs atomically. If one step fails, all rollback.
2. If no matching contact exists, create a new primary contact.
3. If matches exist, gather candidate cluster by primary IDs.
4. Choose canonical primary (oldest by `createdAt`, then `id`).
5. Convert other primaries into secondaries linked to canonical.
6. If request introduces new info (new email or new phone), create a new secondary.
7. Build final response:
`primaryContactId`, `emails`, `phoneNumbers`, `secondaryContactIds`.

Mini snippet for merge:
```ts
await tx.contact.updateMany({
  where: { id: { in: losingPrimaryIds } },
  data: { linkPrecedence: LinkPrecedence.secondary, linkedId: canonicalPrimary.id },
});
```

## 3.4 `src/lib/prisma.ts` (database client)

Important lines:
1. [src/lib/prisma.ts:1](src/lib/prisma.ts#L1)
2. [src/lib/prisma.ts:4](src/lib/prisma.ts#L4)
3. [src/lib/prisma.ts:10](src/lib/prisma.ts#L10)
4. [src/lib/prisma.ts:12](src/lib/prisma.ts#L12)

What these lines do:
1. Import Prisma client.
2. Read `DATABASE_URL` from env.
3. Create Prisma Postgres adapter.
4. Create configured Prisma client instance.

## 3.5 `src/types/api.ts` (shared API contract)

Important lines:
1. [src/types/api.ts:1](src/types/api.ts#L1)
2. [src/types/api.ts:6](src/types/api.ts#L6)

What these lines do:
1. `IdentifyInput` tells route/service what input shape is.
2. `IdentifyResponse` ensures output shape is consistent across code.

## 3.6 Prisma schema (`prisma/schema.prisma`)

Important lines:
1. [prisma/schema.prisma:10](prisma/schema.prisma#L10)
2. [prisma/schema.prisma:15](prisma/schema.prisma#L15)
3. [prisma/schema.prisma:25](prisma/schema.prisma#L25)

What these lines do:
1. Enum `LinkPrecedence` = `primary | secondary`.
2. `Contact` model fields: email, phone, linkedId, timestamps.
3. Self-relation:
`linkedId` points another contact (`primary`) in same table.

## 4) What "normalize" means in your code

Current normalize code in [identify.ts:15](src/routes/identify.ts#L15):
```ts
const email = input.email ? input.email.toLowerCase() : null;
const phoneNumber = input.phoneNumber ? input.phoneNumber.replace(/\D/g, "") : null;
```

Meaning:
1. `"  A@X.com "` becomes `"a@x.com"` (trim from schema, lowercase here).
2. `"+1 (111)-222 3333"` becomes `"1112223333"` (digits only).
3. Different user formats map to one canonical value.

Why:
1. Prevents false duplicates.
2. Makes identity matching deterministic.

## 5) Request lifecycle with exact order

Example input:
```json
{ "email": "A@X.com", "phoneNumber": "111" }
```

Execution order:
1. `index.ts` receives request and routes to `identifyRouter`.
2. `identify.ts` validates with Zod.
3. `identify.ts` normalizes values.
4. `identify.ts` calls `reconcileIdentity`.
5. `reconcile.ts` queries DB for contacts with same email or phone.
6. If none, inserts primary.
7. If found, resolves oldest primary and merges links.
8. If new info appears, inserts secondary.
9. Returns consolidated contact object.

## 6) How to verify everything is correct

1. Generate Prisma client.
```bash
npm run prisma:generate
```

2. Compile TypeScript.
```bash
npm run build
```

3. Run server.
```bash
npm run dev
```

4. Health check.
```bash
curl http://localhost:3000/health
```
Expected:
```json
{"ok":true}
```

5. Identity sequence test.
```bash
curl -X POST http://localhost:3000/identify -H "Content-Type: application/json" -d "{\"email\":\"a@x.com\",\"phoneNumber\":\"111\"}"
curl -X POST http://localhost:3000/identify -H "Content-Type: application/json" -d "{\"email\":\"b@x.com\",\"phoneNumber\":\"111\"}"
curl -X POST http://localhost:3000/identify -H "Content-Type: application/json" -d "{\"email\":\"c@x.com\",\"phoneNumber\":\"222\"}"
curl -X POST http://localhost:3000/identify -H "Content-Type: application/json" -d "{\"email\":\"a@x.com\",\"phoneNumber\":\"222\"}"
```

Expected behavior from reading the implementation:
1. First call creates primary.
2. Second call adds secondary under first primary.
3. Third call creates separate primary.
4. Fourth call merges both groups under oldest primary.

## 7) Beginner glossary (Node/Express terms you are seeing)

1. Middleware:
Function that runs before route handlers.
Example: `express.json()` parses request body.

2. Router:
Mini app that groups route handlers.
Example: `identifyRouter`.

3. `req`, `res`, `next`:
`req` is request, `res` sends response, `next` passes control or error.

4. Transaction:
DB operations grouped as one unit.
All succeed or all fail.

5. Zod:
Runtime validator for incoming JSON.
If schema mismatch, throws clear validation error.

6. Prisma:
Type-safe DB client used instead of raw SQL in app logic.

## 8) Current state summary

1. All required files exist.
2. Route + normalization + reconciliation are fully implemented.
3. DB schema and migration baseline exist.
4. A successful build and live reconciliation flow still require a configured PostgreSQL environment. These commands were not executed during this documentation review.
