# Bitespeed Backend Task - Identity Reconciliation

Backend service for contact identity reconciliation using Node.js, Express, TypeScript, Prisma, and PostgreSQL.

## Live Endpoint

- Hosted Base URL: `PASTE_YOUR_HOSTED_BASE_URL_HERE`
- Identify Endpoint: `POST /identify`
- Health Endpoint: `GET /health`

Example after hosting:

- `GET https://your-app.onrender.com/health`
- `POST https://your-app.onrender.com/identify`

## Tech Stack

- Node.js + Express
- TypeScript
- Prisma ORM
- PostgreSQL (Neon)

## API Contract

### Request

`POST /identify`

```json
{
  "email": "string | null (optional)",
  "phoneNumber": "string | number | null (optional)"
}
```

At least one of `email` or `phoneNumber` must be provided.

### Response

```json
{
  "contact": {
    "primaryContatctId": 1,
    "emails": ["a@x.com", "b@x.com"],
    "phoneNumbers": ["111", "222"],
    "secondaryContactIds": [2, 3]
  }
}
```

## Local Setup (Windows PowerShell)

```powershell
git clone https://github.com/aarish-io/Bitspeed_endpoint.git
cd Bitspeed_endpoint
npm install
```

Create `.env`:

```env
DATABASE_URL="YOUR_NEON_POSTGRES_CONNECTION_URL"
PORT=3000
```

Generate Prisma client + ensure schema is in sync:

```powershell
npm run prisma:generate
npx prisma migrate dev --name init_contact
```

Start app:

```powershell
npm run dev
```

## Test Commands (Windows PowerShell)

```powershell
$base = "http://localhost:3000"

Invoke-RestMethod -Method Get -Uri "$base/health"

Invoke-RestMethod -Method Post -Uri "$base/identify" -ContentType "application/json" -Body '{"email":"a@x.com","phoneNumber":"111"}' | ConvertTo-Json -Depth 6
Invoke-RestMethod -Method Post -Uri "$base/identify" -ContentType "application/json" -Body '{"email":"b@x.com","phoneNumber":"111"}' | ConvertTo-Json -Depth 6
Invoke-RestMethod -Method Post -Uri "$base/identify" -ContentType "application/json" -Body '{"email":"c@x.com","phoneNumber":"222"}' | ConvertTo-Json -Depth 6
Invoke-RestMethod -Method Post -Uri "$base/identify" -ContentType "application/json" -Body '{"email":"a@x.com","phoneNumber":"222"}' | ConvertTo-Json -Depth 6
```

Validation checks:

```powershell
try { Invoke-WebRequest -Method Post -Uri "$base/identify" -ContentType "application/json" -Body "{}" -ErrorAction Stop } catch { "Status: $([int]$_.Exception.Response.StatusCode)"; $_.ErrorDetails.Message }
try { Invoke-WebRequest -Method Post -Uri "$base/identify" -ContentType "application/json" -Body '{"email":"not-an-email"}' -ErrorAction Stop } catch { "Status: $([int]$_.Exception.Response.StatusCode)"; $_.ErrorDetails.Message }
```

## Notes

- `GET /` is not defined by design, so `Cannot GET /` is expected.
- Contact records are reconciled and merged according to oldest primary-contact rule.

## Submission Checklist

- [ ] Push this repository to GitHub
- [ ] Deploy app publicly (Render/Railway/etc.)
- [ ] Replace hosted URL placeholder in this README
- [ ] Submit GitHub repo + hosted endpoint
