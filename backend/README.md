# Mraru — Onboarding & Sign-Up API

First module of the **Mraru** chama management platform: tenant (chama) creation and
verified member onboarding. Fastify v4 + PostgreSQL (self-hosted) + Drizzle ORM,
JWT auth with rotation, Postgres RLS as a second enforcement layer, BullMQ + Redis
for SMS, MinIO for KYC documents.

## Quick start

```bash
# 1. Infrastructure (Postgres, Redis, MinIO)
docker compose up -d

# 2. Config
cp .env.example .env

# 3. Install, migrate, run
npm install
npm run db:migrate
npm run dev          # API on :4000
```

## Dev fallbacks (no external services needed)

| Service  | When unset                         | Fallback                                             |
| -------- | ---------------------------------- | ---------------------------------------------------- |
| SMS/Tilil| `SMS_PROVIDER=dev`                 | OTP codes printed to the API console                 |
| Redis    | `REDIS_URL` empty                  | SMS sent inline; in-memory rate limiter              |
| MinIO    | `S3_ENDPOINT` empty                | Files stored on local disk under `./uploads`         |

## Key design decisions

- **Tenant isolation**: every chama-scoped table carries `chama_id`; the app filters
  by `chama_id` from the JWT claim *and* Postgres RLS enforces the same predicate
  (`current_setting('app.chama_id')`) with `FORCE ROW LEVEL SECURITY`.
  Authenticated handlers run inside `withTenant()` transactions that `SET LOCAL` the
  claim, so a leaked raw SQL query still cannot cross tenants.
- **National IDs**: AES-256-GCM encrypted at rest (`ENCRYPTION_KEY`), returned
  redacted (`NC-••••1234`) in API responses except to the owning member and Chairperson.
- **Governance guards (server-side)**: a chama cannot reach `active` with only a
  Chairperson — Treasurer **and** Secretary must be assigned; invite links alone
  never grant financial roles; approval is always a human sign-off.
- **OTP**: 6-digit, 5-min expiry, max 3 sends/phone/10min, attempts limited, hashed
  with SHA-256 + salt; password reset requires OTP re-verification.
- **Audit**: every mutating endpoint writes an immutable `audit_log` row.

## API (v1)

| Method | Path                             | Access                        |
| ------ | -------------------------------- | ----------------------------- |
| POST   | `/api/v1/auth/otp/send`          | public                        |
| POST   | `/api/v1/auth/otp/verify`        | public                        |
| POST   | `/api/v1/auth/login`             | public                        |
| POST   | `/api/v1/auth/refresh`           | public (refresh token)        |
| GET    | `/api/v1/auth/me`                | any member                    |
| POST   | `/api/v1/chamas`                 | public (OTP-grant required)   |
| POST   | `/api/v1/chamas/:slug/join`      | public (OTP-grant required)   |
| POST   | `/api/v1/members/:id/kyc`        | member (self)                 |
| GET    | `/api/v1/members/pending`        | secretary / chairperson       |
| POST   | `/api/v1/members/:id/approve`    | secretary / chairperson       |
| POST   | `/api/v1/members/:id/reject`     | secretary / chairperson       |
| GET    | `/api/v1/constitutions/current`  | any member                    |
| POST   | `/api/v1/constitutions/upload`   | chairperson (auth)            |
| POST   | `/api/v1/constitutions`          | chairperson (amendment)       |
| POST   | `/api/v1/constitutions/:id/accept`| any member                   |
| POST   | `/api/v1/invites`                | secretary / chairperson       |
| GET    | `/api/v1/invites`                | chairperson                   |

## Notes on the Tilil SMS integration

Tilil's developer docs are behind their customer portal and were not publicly
accessible at build time. The `TililSmsProvider` implements their commonly
documented v3 REST format (`POST {base}/sms/send` with `Authorization: Bearer`,
JSON body `{ username, apikey, senderid, recipient, msg }`) — verify the exact
field names/headers against your Tilil dashboard before enabling `SMS_PROVIDER=tilil`
in production. The provider interface makes swapping this trivial.
