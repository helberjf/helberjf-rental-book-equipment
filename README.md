# Rental Book Equipment

Professional event-rental management for individual equipment units, schedules, staff assignments and payments.

The initial inventory contains eight LED robots and one LED swing. The data model remains generic so more categories, products and physical units can be added later.

## Features

- event date, start time and end time, including overnight events;
- responsible person, contact, email and venue;
- individually selected equipment units;
- overlap protection using `[start, end)` time intervals;
- one or more assigned employees;
- charged, received and automatically calculated remaining amounts;
- administrative calendar with event details;
- operational dashboard and upcoming-event view;
- monthly report with printable layout;
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
