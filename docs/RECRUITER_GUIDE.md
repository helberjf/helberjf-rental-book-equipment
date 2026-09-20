# Recruiter Guide

Use this document as a speaking guide when presenting the project to a recruiter, hiring manager, or technical interviewer. The project is intentionally described with clear boundaries between implemented work, inherited foundation, and planned work.

## 30-second pitch

> This is a full-stack rental-management system for event equipment. The business problem is scheduling real physical units and staff across precise time windows, so the same item can be reused later on the same day without allowing overlapping bookings. The repository has a React/Vite admin interface, an Express/Prisma backend, a PostgreSQL schema and seed, calendar and reporting workflows, bilingual responsive administration, a public landing page, and tested availability and rental rules. The next product increments are public quote requests and deeper production hardening.

## 2–3 minute explanation

You can present it in this order:

> I started from an existing rental-management foundation and adapted it into an event-equipment rental system. The first real use case is a company that rents equipment such as LED robots and an LED swing, but the model supports any rentable asset that needs scheduling, unit tracking, payments, staff assignment, and reporting.

> The repository is organized as a monorepo. `api` contains the Express backend, Prisma schema, migrations, seed, repositories, services, routes, and domain tests. `app` is the authenticated admin interface with equipment, team, calendar, payments, reports, mobile layouts, and language switching. `store` remains a separate public storefront foundation, while the current public marketing experience lives in the admin application's landing route.

> The main domain decision is time-based availability. A unit is blocked from a start time to an end time, optionally expanded by preparation or teardown buffers. Two reservations conflict only when the intervals overlap. The availability service is isolated from HTTP code and currently tests non-overlapping same-day usage, overlapping reservations, exclusive interval ends, buffers, maintenance, unavailable statuses, quantity-based products, and unit suggestions.

> The next step is to finish the public quote-request flow and strengthen production guarantees around concurrent confirmation, observability, and deployment. The current operational baseline already includes the calendar, monthly reports, staff and equipment workflows, payment tracking, and a seeded PostgreSQL model.

## The central engineering problem

### Why date-only availability is incorrect

Suppose the company owns one physical unit:

```text
LED Robot 01
Event A: 2026-09-20 14:00 -> 17:00
Event B: 2026-09-20 21:00 -> 23:30
```

The unit is available for both events. A rule that marks the entire day as unavailable would reject a valid booking and reduce the business's capacity.

### Conflict rule

The service checks whether two blocked intervals overlap:

```text
existing.blockedFrom < requested.blockedUntil
AND
existing.blockedUntil > requested.blockedFrom
```

The intervals use `[start, end)` semantics. The start belongs to the interval and the end does not. Therefore, `10:00 -> 14:00` and `14:00 -> 16:00` do not conflict when no buffer is configured.

### What the service accounts for

- Individual physical units can be reserved separately.
- A product can instead be tracked by quantity when individual units are unnecessary.
- Product-level buffers can block preparation, transport, cleaning, or teardown time.
- Open maintenance records make a unit unavailable during a maintenance window.
- Status and active flags explain why a unit cannot be selected.
- The service can suggest enough available units for a requested quantity.

## Technical decisions worth mentioning

### Isolating domain logic

The availability rule lives in `api/src/domain/availability/` instead of being embedded in a route handler. This makes the behavior easier to test, explain, and later connect to database-backed repositories.

### Treating physical units as first-class data

For equipment businesses, a product type such as `LED Robot` is not enough. The operation needs to know whether `LED Robot 01` or `LED Robot 02` is available, damaged, lost, or under maintenance. That is why the target model separates products from physical units.

### Testing business rules as examples

The availability tests read like business scenarios. They demonstrate valid reuse, rejected overlap, adjacent intervals, buffers, maintenance, quantity limits, and unit suggestions. This gives the domain a safety net before it is connected to the full application flow.

### Being explicit about migration status

The repository still contains inherited clothing/ecommerce concepts such as sizes, colors, stock-oriented dashboards, and legacy routes. I keep that context visible and describe the project as an active migration instead of claiming that the target model is already complete.

## Questions you may be asked

### What is already implemented?

The core operational baseline is implemented: equipment and staff management, event creation, time-based conflict validation, payment tracking, calendar, dashboard, printable monthly reports, authentication, bilingual administration, responsive layouts, database migrations, seed data, and workflow tests. The public quote-request flow and some production-hardening work remain.

### How do you prevent double-booking?

The domain and service layers detect interval conflicts and return unavailable units. The API also performs confirmation-time validation. The next hardening step is to make the concurrency guarantee explicit at the persistence boundary so simultaneous confirmations cannot both reserve the same unit. That final guarantee should be described as in progress until it is verified under concurrent load.

### Why is the codebase mixed between JavaScript and TypeScript?

The project began from an existing JavaScript backend. The newer API path uses TypeScript services, repositories, schemas, and controllers, while some inherited modules remain in JavaScript. This lets the operational domain move forward while legacy modules are retired incrementally.

### Why are there three applications?

The backend owns business rules and persistence. The admin app is for internal operations such as products, rentals, payments, and reports. The store is the public-facing surface, which will eventually collect quote requests rather than confirm bookings directly.

### What would you build next?

I would finish the public quote-request flow, add CI and production observability, exercise concurrent confirmation against a disposable database, and continue consolidating legacy modules around the typed service/repository boundary.

### How would you improve the project before production?

I would finish the generic schema and migrations, add API integration and end-to-end tests, introduce database-level concurrency protection, clean up inherited modules, add environment and deployment documentation, and add CI for tests, typechecking, and frontend builds.

### How do you know the availability rule is correct?

The rule is expressed directly in the service and covered by focused tests for both sides of the boundary: overlapping and non-overlapping reservations, adjacent intervals, buffers, maintenance, individual units, and quantity-based products. The examples make the business meaning reviewable without reading every controller.

## Suggested demo path

1. Start with the business problem and the one-unit same-day example.
2. Open the Equipment and Team screens to show physical resources and staff commitments.
3. Create or open an event in Calendar and show the assigned equipment, staff, and payment state.
4. Open [`availability.service.ts`](../api/src/domain/availability/availability.service.ts) and its tests to explain the overlap rule.
5. Open Reports to show monthly totals and the print-friendly operational view.
6. Explain the `api` / `app` / `store` split using [`PROJECT_STRUCTURE.md`](PROJECT_STRUCTURE.md), then close with quote requests and production hardening.

## Wording to keep precise

Use:

- “The availability domain is implemented and tested.”
- “The core event-operations workflow is implemented and verified with automated tests.”
- “The public quote flow and concurrency hardening are the next product increments.”
- “The calendar, reports, equipment, staff, and payment workflows are available in the current baseline.”

Avoid:

- “The system is production-ready.”
- “Every possible production concurrency case has already been proven.”
- “The public quote flow is already a confirmed booking flow.”

## Closing summary

The project demonstrates a practical engineering approach: start from a working foundation, identify the business rule that matters most, isolate it in a testable domain module, and migrate the surrounding system around that source of truth. The most valuable discussion is not the number of screens; it is how physical inventory, time intervals, buffers, maintenance, and concurrency shape the design.
