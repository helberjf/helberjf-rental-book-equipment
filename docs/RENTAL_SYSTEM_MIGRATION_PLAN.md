# Rental System Migration Plan

## Context

This repository is being transformed into a professional, generic, and reusable rental-management system. The first real business use case is event equipment rental: 8 LED robots and 1 LED swing.

The final product must not hard-code that business. LED robots and the LED swing are seed data only. The domain should support any rentable asset that needs date, time, availability, staff assignment, payment tracking, and reporting.

## Core Product Decision

Availability is based on an individual equipment unit and a time interval, not on a full calendar day.

The system must store:

```text
blockedFrom
blockedUntil
```

Conflict detection must use:

```text
existing.blockedFrom < requested.blockedUntil
AND
existing.blockedUntil > requested.blockedFrom
```

Intervals follow `[start, end)`: start is inclusive and end is exclusive. This allows one event ending at 17:00 and another starting at 17:00 to use the same unit, unless a buffer rule is configured.

## Existing Base

The imported base already contains:

- Express backend;
- Prisma ORM;
- PostgreSQL schema;
- JWT authentication;
- admin routes;
- product, rental, payment, invoice, deposit, return, promotion, cart, wishlist, and audit-log concepts;
- React + Vite admin app;
- React + Vite public store app.

This is useful as a starting point, but the inherited domain is closer to an ecommerce/clothing rental workflow. The new project must progressively replace that with a generic event-equipment workflow.

## What Can Be Reused

- Authentication and authorization structure.
- Prisma and PostgreSQL setup.
- General admin panel shell.
- Payment concepts.
- Invoice and reporting concepts.
- Audit-log concept.
- Transactional patterns in the rental flow.

## What Should Be Replaced

- Clothing-specific fields such as size and color as primary rental concepts.
- Mutable stock-only availability as the only conflict mechanism.
- Full-day rental assumptions.
- Public ecommerce checkout as the main flow.
- Any legacy labels, comments, messages, or documentation not written in English.

## Target Domain Model

Core entities:

- `Product`: generic rentable product type.
- `ProductUnit`: physical unit, such as `LED Robot 01`.
- `Customer`: event client or responsible person.
- `Employee`: person assigned to work the event.
- `Rental`: event booking with date, start time, end time, values, status, and notes.
- `RentalItem`: product requested in the rental.
- `RentalItemUnit`: specific physical units assigned to a rental item.
- `EquipmentReservation`: time-based block for availability.
- `Payment`: received payment records.
- `RentalRequest`: public quote request before admin confirmation.
- `MaintenanceRecord`: unit downtime that blocks availability.

## Required Operational Fields

Each event booking must support:

- event date;
- start time;
- end time;
- responsible person name;
- responsible person contact;
- charged amount;
- received amount;
- remaining amount calculated from payments;
- assigned employee;
- selected equipment units.

## MVP Flow

1. Admin creates or edits products.
2. Admin registers physical units.
3. Admin creates customers and employees.
4. Admin creates a rental/event with date and start/end time.
5. Admin selects specific equipment units.
6. Backend checks time-based conflicts.
7. Backend creates equipment reservations.
8. Admin records payments.
9. System calculates remaining balance.
10. Calendar shows confirmed and future events.
11. Monthly report can be printed.

## Public Flow

The public website should not create confirmed bookings directly.

Recommended flow:

```text
Landing page -> Public catalog -> Quote request -> Admin converts request into rental
```

## Calendar Requirements

The admin calendar must:

- display all events by month, week, and day;
- show start and end time;
- show customer/responsible person;
- show assigned employee;
- show selected equipment units;
- make future events easy to identify;
- allow creating or editing a booking from the calendar.

## Reporting Requirements

Monthly reports must show:

- total event count;
- future event count;
- total charged amount;
- total received amount;
- total remaining amount;
- events grouped by date;
- customer/responsible person;
- employee assigned;
- equipment assigned;
- payment status.

Reports should have a print-friendly layout and may later export CSV or Excel.

## First Implementation Phases

1. Keep the project buildable after the language cleanup.
2. Recreate Git history from zero and point it to the new repository.
3. Refactor backend structure around services and repositories.
4. Add the generic Prisma models.
5. Seed 8 LED robots and 1 LED swing.
6. Connect the existing `AvailabilityService` to real persistence.
7. Create rental/event APIs.
8. Create customer and employee APIs.
9. Create payment APIs and balance calculation.
10. Build the admin calendar.
11. Build monthly printable reports.
12. Add public quote request flow.

## Testing Strategy

Required tests:

- same unit, same day, non-overlapping times are allowed;
- same unit, overlapping times are rejected;
- event ending at 14:00 allows another event starting at 14:00 without buffer;
- buffer blocks adjacent events when configured;
- maintenance blocks unit availability;
- quantity-based products calculate maximum concurrent reservations;
- concurrent confirmations for the same unit only allow one success;
- seed scenario with 8 LED robots and 1 LED swing.

## Acceptance Criteria

The first useful delivery is complete when the system can:

- register generic products;
- register physical equipment units;
- register customers and employees;
- create an event rental with date and start/end time;
- select equipment units and staff;
- block conflicting schedules;
- allow two same-day events when time windows do not overlap;
- track charged, received, and remaining amounts;
- show the calendar;
- print monthly reports.

## Fixed Decisions

- The project language is English.
- Availability is time-based, not day-based.
- Individual equipment units are required.
- The backend is the source of truth for conflict validation.
- `remainingAmount` should be calculated, not manually stored.
- LED robots and the LED swing are initial seed data, not hard-coded rules.
