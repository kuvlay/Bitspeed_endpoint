# Contact Identity Reconciliation API

An Express API that connects contact records sharing an email address or phone number. When two previously separate contact groups are linked, the oldest primary contact remains canonical and the other records are consolidated under it.

**TypeScript · Express 5 · Prisma 7 · PostgreSQL · Zod**

[Health endpoint](https://bitspeed-endpoint.onrender.com/health) · [Portfolio](https://github.com/kuvlay)

## How it works

1. Validate and normalize the incoming email/phone number.
2. Find matching, non-deleted contacts and their linked groups.
3. Select the oldest primary record, merge linked groups, and create a secondary record when new contact information is supplied.
4. Return a deduplicated view of emails, phone numbers, and secondary IDs.

Reconciliation runs inside a Prisma transaction. Email, phone number, and linked-contact fields are indexed in the PostgreSQL schema.

## API

| Route | Purpose |
| --- | --- |
| `GET /health` | Return `{ "ok": true }` |
| `POST /identify` | Reconcile a contact and return its consolidated identity |

```bash
curl -X POST http://localhost:3000/identify   -H 'Content-Type: application/json'   -d '{"email":"candidate@example.com","phoneNumber":"1234567890"}'
```

At least one field is required. The response contains `contact.primaryContatctId`, `emails`, `phoneNumbers`, and `secondaryContactIds`. The spelling `primaryContatctId` is the existing API contract and is intentionally documented as implemented.

## Run locally

Requirements: Node.js/npm compatible with the locked Prisma dependencies, and a PostgreSQL database.

```bash
git clone https://github.com/kuvlay/Bitspeed_endpoint.git
cd Bitspeed_endpoint
npm ci
```

Create `.env` with your own configuration:

```dotenv
DATABASE_URL=postgresql://YOUR_USER:YOUR_PASSWORD@YOUR_HOST/YOUR_DATABASE
PORT=3000
```

Generate the client, apply migrations to a development database, and start the API:

```bash
npm run prisma:generate
npm run prisma:migrate
npm run dev
```

`npm run build` generates the Prisma client and compiles TypeScript; `npm start` runs `dist/index.js`. Database migration commands change the configured database, so use a dedicated local/development instance.

## Structure and validation

- `src/routes/identify.ts`: input validation, normalization, and response mapping.
- `src/lib/reconcile.ts`: contact-group resolution and transactional updates.
- `prisma/schema.prisma`: contact model and indexes.

The public health endpoint responded successfully during review. Reconciliation flows and a fresh build were not executed. The inherited `npm test` script is a placeholder that exits with an error; it is not a test suite.

<details>
<summary>Credits and project history</summary>

Source lineage: [aarish-io/Bitspeed_endpoint](https://github.com/aarish-io/Bitspeed_endpoint). Original contributor history is retained. The package manifest declares ISC; no standalone license text was present in the reviewed source.

</details>
