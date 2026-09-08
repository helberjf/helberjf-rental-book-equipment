# Rental Book Equipment

Professional full-stack rental management system for event equipment.

The first real use case is a company that rents 8 LED robots and 1 LED swing for events. The system is being shaped as a generic and reusable product, so the same foundation can later manage any rentable item: LED equipment, audiovisual gear, tools, furniture, costumes, bikes, vehicles, electronics, and more.

## Goal

Build a professional platform to register events, control time-based availability, assign individual equipment units, track payments, and print monthly reports.

The core scheduling flow must capture:

- event date;
- start time and end time;
- responsible person name;
- responsible person contact;
- charged amount;
- received amount;
- remaining amount calculated automatically;
- assigned employee or employees;
- rented equipment, including specific physical units.

## Main Availability Rule

Availability must not be calculated as a whole-day block.

The system must use:

```text
equipment/unit + start time + end time
```

Example:

```text
LED Robot 01
Event A: 2026-09-20 14:00 -> 17:00
Event B: 2026-09-20 21:00 -> 23:30
```

Both events may use the same LED Robot 01 if their blocked intervals do not overlap.

The backend must validate conflicts with this rule:

```text
existing.blockedFrom < requested.blockedUntil
AND
existing.blockedUntil > requested.blockedFrom
```

Intervals follow the `[start, end)` convention: the start is inclusive and the end is exclusive.

## Current Status

This project started from an external rental-management base and is being migrated into the final event-equipment rental domain.

Already available:

- Express + Prisma + PostgreSQL backend imported from the base project;
- React + Vite admin frontend imported from the base project;
- React + Vite public/store frontend imported from the base project;
- tested availability domain in `api/src/domain/availability`;
- tests covering unit-level availability, same-day schedules, overlaps, buffers, maintenance, and quantity-based products.

Still required for the final workflow:

- generic schema with `Product`, `ProductUnit`, `Customer`, `Employee`, `Rental`, `RentalItemUnit`, `EquipmentReservation`, and `Payment`;
- seed data for 8 LED robots and 1 LED swing;
- admin calendar with FullCalendar;
- equipment schedule view;
- printable monthly report;
- macro dashboard for current and future events;
- public quote request flow;
- conversion from quote request to rental;
- transactional backend protection against double-booking.

## Planned Stack

Frontend:

- React;
- TypeScript;
- Vite;
- React Router;
- Tailwind CSS;
- shadcn/ui;
- TanStack Query;
- React Hook Form;
- Zod;
- FullCalendar;
- Recharts.

Backend:

- Node.js;
- TypeScript;
- Express.js;
- PostgreSQL;
- Prisma ORM;
- Zod;
- JWT;
- bcrypt;
- Helmet;
- rate limiting;
- structured logs.

Target architecture:

```text
Controller -> Service -> Repository -> Prisma -> PostgreSQL
```

## Current Structure

```text
api/      Express + Prisma backend
app/      React + Vite admin panel
store/    Public storefront inherited from the base project
docs/     Migration and planning documents
```

## Commands

Install dependencies:

```bash
cd api
npm install

cd ../app
npm install

cd ../store
npm install
```

Run backend tests:

```bash
cd api
npm test
```

Run backend TypeScript checks:

```bash
cd api
npm run typecheck
```

Build the frontends:

```bash
cd app
npm run build

cd ../store
npm run build
```

## Verification Baseline

Last known local baseline:

- `api`: availability tests passing;
- `api`: `tsc --noEmit` passing;
- `app`: build passing with inherited AdminLTE warnings;
- `store`: lint and build passing.

## Roadmap

1. Refactor the domain into a generic rental model.
2. Create products and physical units.
3. Create customers and employees.
4. Create rentals with date and time windows.
5. Create time-based equipment reservations.
6. Connect `AvailabilityService` to the database.
7. Protect double-booking with transactions and locks.
8. Create payments and automatic remaining balance calculation.
9. Create calendar and equipment schedule views.
10. Create dashboard and printable reports.

## Repository Target

The new target repository is:

```text
https://github.com/helberjf/helberjf-rental-book-equipment
```

The Git history should be recreated from zero before pushing to that repository.
