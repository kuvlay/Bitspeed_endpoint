# Reading Comprehension: Full Project Walkthrough

This guide explains exactly how your backend works today, top to bottom, with file paths and line numbers.

## 1) Project map

1. [src/index.ts](C:\Users\Aarish\Desktop\Bitspeed_endpoint\src\index.ts)
2. [src/routes/identify.ts](C:\Users\Aarish\Desktop\Bitspeed_endpoint\src\routes\identify.ts)
3. [src/lib/reconcile.ts](C:\Users\Aarish\Desktop\Bitspeed_endpoint\src\lib\reconcile.ts)
4. [src/lib/prisma.ts](C:\Users\Aarish\Desktop\Bitspeed_endpoint\src\lib\prisma.ts)
5. [src/types/api.ts](C:\Users\Aarish\Desktop\Bitspeed_endpoint\src\types\api.ts)
6. [prisma/schema.prisma](C:\Users\Aarish\Desktop\Bitspeed_endpoint\prisma\schema.prisma)
7. [prisma/migrations/20260301120000_init_contact/migration.sql](C:\Users\Aarish\Desktop\Bitspeed_endpoint\prisma\migrations\20260301120000_init_contact\migration.sql)

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
1. [src/index.ts:1](C:\Users\Aarish\Desktop\Bitspeed_endpoint\src\index.ts:1)
2. [src/index.ts:8](C:\Users\Aarish\Desktop\Bitspeed_endpoint\src\index.ts:8)
3. [src/index.ts:10](C:\Users\Aarish\Desktop\Bitspeed_endpoint\src\index.ts:10)
4. [src/index.ts:14](C:\Users\Aarish\Desktop\Bitspeed_endpoint\src\index.ts:14)
5. [src/index.ts:16](C:\Users\Aarish\Desktop\Bitspeed_endpoint\src\index.ts:16)
6. [src/index.ts:21](C:\Users\Aarish\Desktop\Bitspeed_endpoint\src\index.ts:21)

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
1. [src/routes/identify.ts:6](C:\Users\Aarish\Desktop\Bitspeed_endpoint\src\routes\identify.ts:6)
2. [src/routes/identify.ts:11](C:\Users\Aarish\Desktop\Bitspeed_endpoint\src\routes\identify.ts:11)
3. [src/routes/identify.ts:15](C:\Users\Aarish\Desktop\Bitspeed_endpoint\src\routes\identify.ts:15)
4. [src/routes/identify.ts:29](C:\Users\Aarish\Desktop\Bitspeed_endpoint\src\routes\identify.ts:29)
5. [src/routes/identify.ts:31](C:\Users\Aarish\Desktop\Bitspeed_endpoint\src\routes\identify.ts:31)
6. [src/routes/identify.ts:40](C:\Users\Aarish\Desktop\Bitspeed_endpoint\src\routes\identify.ts:40)
7. [src/routes/identify.ts:43](C:\Users\Aarish\Desktop\Bitspeed_endpoint\src\routes\identify.ts:43)

What these lines do:
1. `identifySchema` defines allowed input shape.
2. `.refine((data) => data.email || data.phoneNumber, ...)`
Extra rule: at least one field must exist.
3. `normalizeInput(...)` standardizes input:
`email -> lowercase`, `phoneNumber -> digits only`.
4. `identifyRouter.post("/", ...)` handles `POST /identify`.
5. `identifySchema.parse(req.body)` validates request. If invalid, throws `ZodError`.
6. `reconcileIdentity(normalized)` calls business logic.
7. If validation fails, returns `400` with details.

Code snippet from route:
```ts
const parsed = identifySchema.parse(req.body);
const normalized = normalizeInput(parsed);
const result = await reconcileIdentity(normalized);
return res.status(200).json({ contact: result });
```

## 3.3 `src/lib/reconcile.ts` (core identity reconciliation)

This is the main algorithm.

Important lines:
1. [src/lib/reconcile.ts:87](C:\Users\Aarish\Desktop\Bitspeed_endpoint\src\lib\reconcile.ts:87)
2. [src/lib/reconcile.ts:96](C:\Users\Aarish\Desktop\Bitspeed_endpoint\src\lib\reconcile.ts:96)
3. [src/lib/reconcile.ts:108](C:\Users\Aarish\Desktop\Bitspeed_endpoint\src\lib\reconcile.ts:108)
4. [src/lib/reconcile.ts:134](C:\Users\Aarish\Desktop\Bitspeed_endpoint\src\lib\reconcile.ts:134)
5. [src/lib/reconcile.ts:146](C:\Users\Aarish\Desktop\Bitspeed_endpoint\src\lib\reconcile.ts:146)
6. [src/lib/reconcile.ts:170](C:\Users\Aarish\Desktop\Bitspeed_endpoint\src\lib\reconcile.ts:170)
7. [src/lib/reconcile.ts:183](C:\Users\Aarish\Desktop\Bitspeed_endpoint\src\lib\reconcile.ts:183)

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
1. [src/lib/prisma.ts:1](C:\Users\Aarish\Desktop\Bitspeed_endpoint\src\lib\prisma.ts:1)
2. [src/lib/prisma.ts:4](C:\Users\Aarish\Desktop\Bitspeed_endpoint\src\lib\prisma.ts:4)
3. [src/lib/prisma.ts:10](C:\Users\Aarish\Desktop\Bitspeed_endpoint\src\lib\prisma.ts:10)
4. [src/lib/prisma.ts:12](C:\Users\Aarish\Desktop\Bitspeed_endpoint\src\lib\prisma.ts:12)

What these lines do:
1. Import Prisma client.
2. Read `DATABASE_URL` from env.
3. Create Prisma Postgres adapter.
4. Create configured Prisma client instance.

## 3.5 `src/types/api.ts` (shared API contract)

Important lines:
1. [src/types/api.ts:1](C:\Users\Aarish\Desktop\Bitspeed_endpoint\src\types\api.ts:1)
2. [src/types/api.ts:6](C:\Users\Aarish\Desktop\Bitspeed_endpoint\src\types\api.ts:6)

What these lines do:
1. `IdentifyInput` tells route/service what input shape is.
2. `IdentifyResponse` ensures output shape is consistent across code.

## 3.6 Prisma schema (`prisma/schema.prisma`)

Important lines:
1. [prisma/schema.prisma:10](C:\Users\Aarish\Desktop\Bitspeed_endpoint\prisma\schema.prisma:10)
2. [prisma/schema.prisma:15](C:\Users\Aarish\Desktop\Bitspeed_endpoint\prisma\schema.prisma:15)
3. [prisma/schema.prisma:25](C:\Users\Aarish\Desktop\Bitspeed_endpoint\prisma\schema.prisma:25)

What these lines do:
1. Enum `LinkPrecedence` = `primary | secondary`.
2. `Contact` model fields: email, phone, linkedId, timestamps.
3. Self-relation:
`linkedId` points another contact (`primary`) in same table.

## 4) What "normalize" means in your code

Current normalize code in [identify.ts:15](C:\Users\Aarish\Desktop\Bitspeed_endpoint\src\routes\identify.ts:15):
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

Observed expected behavior from this codebase:
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
4. Build succeeds and endpoint flow works.
