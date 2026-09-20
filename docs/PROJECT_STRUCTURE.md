# Project Structure

This repository is a small monorepo for a rental-management system. It contains two user-facing React applications and one backend application.

## Top-level map

```text
business-system/
├── api/       Express backend, Prisma database layer, routes, controllers, domain tests
├── app/       Authenticated React/Vite admin interface
├── store/     Public React/Vite storefront foundation
├── docs/      Product decisions, migration planning, interview material, historical notes
└── README.md  English-first project entry point with a Portuguese summary
```

## `api/` — backend

```text
api/
├── prisma/
│   ├── schema.prisma                 Current database model
│   └── migrations/                   Database migration history
├── src/
│   ├── controllers/                  Request-facing operations, including event rentals
│   ├── domain/                       Availability and rental financial rules with tests
│   ├── lib/                          Prisma infrastructure clients
│   ├── middlewares/                  CORS, authentication, authorization, uploads
│   ├── repositories/                 Persistence boundaries for users, rentals, products, staff, and payments
│   ├── routes/                       API route registration
│   ├── schemas/                      Request validation and workflow schemas
│   ├── services/                     Authentication, rental, and staff-availability workflows
│   └── utils/                        Response helpers
├── app.js                            Express application configuration
└── server.js                         HTTP server entry point
```

The most representative module for the target domain is [`api/src/domain/availability/`](../api/src/domain/availability/). It is intentionally separated from HTTP concerns and currently has tests for:

- non-overlapping same-day reservations;
- overlapping reservations;
- adjacent intervals with exclusive ends;
- before/after buffers;
- maintenance windows;
- quantity-based products;
- suggested available units.

The API still contains inherited routes for users, products, payments, promotions, carts, wishlists, and administration alongside the newer typed rental, catalog, staff, and service modules. This mixed structure is an explicit migration boundary and should become more consistent as the product stabilizes.

## `app/` — admin interface

`app/` is the authenticated administrative interface. It contains the application shell, authentication guard, navigation layout, dashboard, catalog and equipment screens, team management, event operations, calendar, rentals, returns, payments, reservations, reports, audit logs, and the public-facing landing page.

Some legacy screens remain from the original rental/ecommerce base, but the current product baseline already includes the core operational workspace for products, physical units, employees, event rentals, availability, payments, calendars, reports, responsive layouts, and bilingual administration.

## `store/` — public interface

`store/` is the public-facing React/Vite foundation. It currently has the shared layout and home entry point from the original base project. The intended future flow is:

```text
Landing page -> public catalog -> quote request -> admin conversion into a rental
```

It should not create confirmed bookings directly. Confirmation belongs to the backend and administrative workflow.

## `docs/` — product and project documentation

- `RENTAL_SYSTEM_MIGRATION_PLAN.md` contains the target domain model, business rules, MVP flow, and acceptance criteria.
- `PRD.md` contains the product direction, users, requirements, business rules, success measures, and roadmap.
- `RECRUITER_GUIDE.md` contains a ready-to-use explanation for interviews.
- `PROJECT_STRUCTURE.md` is this folder and architecture map.
- `notes/` contains historical setup and migration material that is no longer part of the active application surface.
- `superpowers/` contains development plans and design specifications for this documentation improvement.

## Recommended five-minute reading order

1. Read the root [`README.md`](../README.md) to understand the business problem and current status.
2. Open [`api/src/domain/availability/availability.service.ts`](../api/src/domain/availability/availability.service.ts) to see the central rule.
3. Read [`availability.service.test.ts`](../api/src/domain/availability/availability.service.test.ts) to see the behavior expressed as examples.
4. Skim the Prisma schema and route folders to understand the inherited foundation.
5. Read the [`recruiter guide`](RECRUITER_GUIDE.md) before presenting the project.

## Organization principle

The active product code stays in `api/`, `app/`, and `store/`. Product decisions and user-facing explanations live in `docs/`. Historical scratch files are kept under `docs/notes/` so they remain available without competing with the project entry point.
