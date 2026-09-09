# Rental Book Equipment

Professional event-rental management for individual equipment units, schedules, staff assignments and payments.

The initial inventory contains eight LED robots and one LED swing. The data model remains generic so more categories, products and physical units can be added later.

## Features

- event date, start time and end time, including overnight events;
- responsible person, contact, email and venue;
- individually selected equipment units;
- overlap protection using `[start, end)` time intervals;
- one or more assigned employees;
- staff registration and independent time reservations, with conflict protection;
- equipment registration and editing: weight, height, width, length, color and per-unit rental price;
- automatically suggested booking price, with manual override for negotiated packages;
- service-only appointments without equipment;
- charged, received and automatically calculated remaining amounts;
- administrative calendar with event details;
- operational dashboard and upcoming-event view;
- monthly report with printable layout;
- Portuguese/English administration with a persistent language selector;
- mobile layouts, day agenda and touch-friendly controls;
- Robô de LED JF landing page featuring supplied event photos and an AI-edited hero;
- JWT-protected administration;
- PostgreSQL schema, migration and idempotent seed.

## Architecture

```text
React/Vite admin -> Express API -> Services -> Repositories -> Prisma -> PostgreSQL
```

Main applications:

- `app/`: administrative web application;
- `api/`: Express API, Prisma schema and database seed;
- `store/`: inherited public storefront kept outside the current production flow.

## Local setup

Requirements: Node.js 22+ and PostgreSQL.

```bash
cd api
npm install
copy .env.example .env
npx prisma migrate deploy
npx prisma db seed
npm run dev
```

In another terminal:

```bash
cd app
npm install
copy .env.example .env
npm run dev
```

Default local administrator:

```text
Email: admin@rentalbook.local
Password: ChangeMe123!
```

Always set `ADMIN_INITIAL_PASSWORD` before seeding a production database.

## Quality checks

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

## Production variables

API:

- `DATABASE_URL`: PostgreSQL connection string;
- `JWT_SECRET`: random value with at least 32 characters;
- `ADMIN_INITIAL_PASSWORD`: initial administrator password;
- `FRONTEND_URL`: allowed admin application URL.

Admin application:

- `VITE_API_SERVER`: deployed API origin.

## Repository

[helberjf/helberjf-rental-book-equipment](https://github.com/helberjf/helberjf-rental-book-equipment)

## Operating guide

1. In **Equipment**, register physical units using unique identifiers. Enter measurements in kg/cm and the default price in BRL. Edit existing equipment to set its actual rate; initial inventory has no assumed commercial prices.
2. In **Team**, add employees and reserve standalone time slots. Event assignments and manual bookings share the same availability checks.
3. Select a date in **Calendar**, then create a booking. Enter the responsible person, contact, start/end, staff, equipment and payment. Overlapping reservations are rejected; consecutive non-overlapping events are allowed.
4. **Reports** filters by month, totals charged/received/outstanding amounts, counts future events and prints using the browser's print dialog (including Save as PDF).
5. Use **System language** in the dashboard header. User-entered names and descriptions remain as entered. The public marketing page is in Portuguese.

The additive staff/equipment migration is applied by the API deployment build. Existing bookings and payments are preserved. Production builds do not rerun the initial seed, so custom equipment names, staff, unit status and administrator credentials are not reset on redeployment. Run the seed explicitly only when provisioning a new database.

### Isolated workflow verification

`api/scripts/verify-workflows.cjs` exercises the authenticated API on port 3335. Run it **only** against a disposable test schema, seeded separately; set `QA_PASSWORD` to that schema's administrator password. It creates test staff, equipment, bookings and payments. Never point the local test API at production data.

See [media provenance](docs/media-assets.md) for the supplied screenshots and generated hero asset.

Developed by [Helber Soares](https://www.linkedin.com/in/helber-soares/).
