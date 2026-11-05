# Rental Book Equipment

A full-stack operations system for renting individual event-equipment units, scheduling staff and tracking payments. The central domain problem is **availability over a time interval**, including overnight events, rather than simply marking a calendar day as unavailable.

## Review the main workflow

1. Register equipment types and uniquely identified physical units, plus staff members and their standalone reservations.
2. Create an event with start/end times, selected units, staff fees, contact details and a negotiated price.
3. Confirm availability, record received payments and inspect the remaining balance in the calendar or monthly report.

Intervals are half-open: `[start, end)`. An event ending at 18:00 can be followed by one starting at 18:00, subject to configured setup/teardown buffers. Service-only appointments are supported. Monetary amounts in the API use integer cents.

## Architecture and code tour

```text
React/Vite administration → Express API → domain services → repositories → Prisma/PostgreSQL
```

| Location | Responsibility |
| --- | --- |
| [app](app) | Calendar, dashboard, equipment/staff management, reports and Portuguese/English administration. |
| [api/src/services/rental.service.ts](api/src/services/rental.service.ts) | Booking validation, reservation intervals and financial views. |
| [api/src/repositories/rental.repository.ts](api/src/repositories/rental.repository.ts) | Transactional confirmation, advisory locks and overlap queries. |
| [api/src/domain](api/src/domain) | Availability and financial rules with focused tests. |
| [store](store) | Inherited storefront, outside the current operational flow. |

Confirmation locks the rental, relevant equipment products and physical units within a PostgreSQL transaction, then checks availability before creating active reservations. This is a concrete concurrency mechanism; any new booking writer must participate in the same locking protocol. It should not be described as a universal database constraint covering arbitrary direct writes.

## Run locally

Requirements: Node.js 22+ and PostgreSQL. Copy `api/.env.example` to `api/.env` and `app/.env.example` to `app/.env` (`cp` on POSIX shells, `Copy-Item` in PowerShell). Configure the API's `DATABASE_URL`, `JWT_SECRET`, `ADMIN_INITIAL_PASSWORD` and `FRONTEND_URL`; configure `VITE_API_SERVER` for the web app.

```bash
cd api
npm install
npx prisma migrate deploy
npx prisma db seed
npm run dev
```

Run the migration and seed only against the intended development database. Set an explicit initial administrator password before seeding; the seed is provisioning work, not a routine application restart.

In a second terminal:

```bash
cd app
npm install
npm run dev
```

## Decisions and trade-offs

The interval model and legacy-store separation are documented in the [migration plan](docs/RENTAL_SYSTEM_MIGRATION_PLAN.md). The table also explains the implications of the current source.

| Choice | Benefit | Cost or boundary |
| --- | --- | --- |
| Physical units and half-open time intervals | Models real equipment availability and consecutive events precisely. | Overnight dates, buffers, staff commitments and time-zone handling need consistent rules. |
| Transaction-scoped PostgreSQL advisory locks | Serializes competing confirmations for the same resources. | Correctness depends on every writer using the protocol; contention and lock order matter. |
| Integer cents plus explicit payment status | Keeps charged/received/outstanding calculations auditable. | Currency formatting and provider settlement are separate concerns; a recorded payment is not a payment-gateway integration. |
| Suggested pricing with manual override | Supports negotiated event packages. | The UI must make the agreed amount and staff costs clear rather than silently recalculating history. |
| Separate API and administration app | Makes domain and UI responsibilities easy to inspect. | Requires two local processes and explicit API origin/authentication configuration. |

## Verification and deployment

```bash
cd api
npm run typecheck
npm test
npm run build
cd ../app
npm run lint
npm test
npm run build
```

The API's `vercel-build` command applies `prisma migrate deploy` before compilation; its ordinary `build` only compiles TypeScript. Deployment does not automatically rerun the seed. Review migrations and database targets before deploying.

The [workflow verifier](api/scripts/verify-workflows.cjs) exercises authenticated operations on port 3335 and creates staff, units, bookings and payments. Run it only against a separately seeded disposable schema, with `QA_PASSWORD` configured for that schema. Domain tests and this workflow check have different scopes; a new production concurrency or migration guarantee needs its own evidence.

## Operating notes and documentation

Register units with unique identifiers and measurements in kg/cm; initial inventory does not imply commercial prices. Staff assignments and independent reservations share availability checks. Monthly reports summarize charged, received and outstanding amounts and can be printed. Administrative language selection does not translate user-entered data; the public marketing page is Portuguese.

- [Product requirements](docs/PRD.md)
- [Interview walkthrough](docs/RECRUITER_GUIDE.md)
- [Project structure and reading order](docs/PROJECT_STRUCTURE.md)
- [Migration plan](docs/RENTAL_SYSTEM_MIGRATION_PLAN.md)
- [Media provenance](docs/media-assets.md)

Developed by [Helber Soares](https://www.linkedin.com/in/helber-soares/).
