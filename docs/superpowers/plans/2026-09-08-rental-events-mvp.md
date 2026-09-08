# Rental Events MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first usable event-rental management slice for 8 LED robots and 1 LED swing, with event scheduling, responsible contact, assigned employees, payments, remaining balance, and a calendar/report foundation.

**Architecture:** Start with the backend domain and database because calendar and reports must rely on correct persisted data. Keep the existing Express app, but add a generic Prisma schema and service boundaries around rentals, product units, payments, employees, and availability before replacing the old UI screens.

**Tech Stack:** Node.js, TypeScript, Express, Prisma, PostgreSQL, Vitest, React, Vite.

---

## File Structure

- Modify `api/prisma/schema.prisma`: replace the clothing/marketplace schema with the generic rental schema.
- Create `api/prisma/seed.ts`: seed admin user, categories, Robo LED product, Robo 01-08 units, Balanco LED product, Balanco LED 01 unit, and sample employees.
- Create `api/src/domain/rentals/rental-financials.ts`: calculate received and remaining amounts from confirmed payments.
- Create `api/src/domain/rentals/rental-financials.test.ts`: test financial calculations.
- Extend `api/src/domain/availability/availability.service.test.ts`: add the real two-event robot scenario.
- Modify `api/src/domain/availability/availability.service.ts`: only if the new tests expose a gap.
- Create `api/src/schemas/rental.schemas.ts`: Zod schemas for rental create/update/payment payloads.
- Create `api/src/repositories/*.ts`: Prisma access for products, units, customers, employees, rentals, payments, and reservations.
- Create `api/src/services/*.ts`: business rules for rentals, confirmation, payments, dashboard and reports.
- Create `api/src/controllers/*.ts`: thin HTTP handlers calling services.
- Create `api/src/routes/*.ts`: routes for products, customers, employees, rentals, payments, dashboard, reports and calendar events.
- Modify `app/src/pages/Rentals.jsx`: later replaced by event-focused rental entry.
- Create `app/src/pages/Calendar.jsx`: admin calendar view.
- Create `app/src/pages/Reports.jsx`: monthly macro and printable report view.

## Task 1: Financial Calculations

**Files:**

- Create: `api/src/domain/rentals/rental-financials.test.ts`
- Create: `api/src/domain/rentals/rental-financials.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { calculateRentalFinancials } from "./rental-financials";

describe("calculateRentalFinancials", () => {
  it("calculates received and remaining amounts from confirmed payments", () => {
    const result = calculateRentalFinancials({
      finalAmountCents: 150000,
      payments: [
        { amountCents: 50000, status: "CONFIRMED" },
        { amountCents: 25000, status: "PENDING" },
        { amountCents: 20000, status: "CONFIRMED" },
      ],
    });

    expect(result.receivedAmountCents).toBe(70000);
    expect(result.remainingAmountCents).toBe(80000);
  });

  it("never returns a negative remaining amount when overpaid", () => {
    const result = calculateRentalFinancials({
      finalAmountCents: 100000,
      payments: [{ amountCents: 120000, status: "CONFIRMED" }],
    });

    expect(result.receivedAmountCents).toBe(120000);
    expect(result.remainingAmountCents).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd api && npm test -- src/domain/rentals/rental-financials.test.ts`

Expected: FAIL because `./rental-financials` does not exist.

- [ ] **Step 3: Write minimal implementation**

```ts
export type PaymentStatus = "PENDING" | "CONFIRMED" | "CANCELLED";

export interface RentalFinancialInput {
  finalAmountCents: number;
  payments: Array<{
    amountCents: number;
    status: PaymentStatus;
  }>;
}

export interface RentalFinancialResult {
  finalAmountCents: number;
  receivedAmountCents: number;
  remainingAmountCents: number;
}

export const calculateRentalFinancials = (
  input: RentalFinancialInput,
): RentalFinancialResult => {
  const receivedAmountCents = input.payments
    .filter((payment) => payment.status === "CONFIRMED")
    .reduce((total, payment) => total + payment.amountCents, 0);

  return {
    finalAmountCents: input.finalAmountCents,
    receivedAmountCents,
    remainingAmountCents: Math.max(
      input.finalAmountCents - receivedAmountCents,
      0,
    ),
  };
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd api && npm test -- src/domain/rentals/rental-financials.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add api/src/domain/rentals
git commit -m "feat: add rental financial calculations"
```

## Task 2: Real Robot Availability Scenario

**Files:**

- Modify: `api/src/domain/availability/availability.service.test.ts`
- Modify if needed: `api/src/domain/availability/availability.service.ts`

- [ ] **Step 1: Add the failing or confirming test**

Add this test to `api/src/domain/availability/availability.service.test.ts`:

```ts
it("allows Robo 01 in two same-day events when the first blocked interval ends before the second starts", () => {
  const result = AvailabilityService.checkAvailability(
    baseInput({
      units: [
        { id: 1, productId: 1, identifier: "Robo 01", status: "AVAILABLE", active: true },
        { id: 2, productId: 1, identifier: "Robo 02", status: "AVAILABLE", active: true },
        { id: 3, productId: 1, identifier: "Robo 03", status: "AVAILABLE", active: true },
        { id: 4, productId: 1, identifier: "Robo 04", status: "AVAILABLE", active: true },
        { id: 5, productId: 1, identifier: "Robo 05", status: "AVAILABLE", active: true },
        { id: 6, productId: 1, identifier: "Robo 06", status: "AVAILABLE", active: true },
        { id: 7, productId: 1, identifier: "Robo 07", status: "AVAILABLE", active: true },
        { id: 8, productId: 1, identifier: "Robo 08", status: "AVAILABLE", active: true },
      ],
      reservations: [
        reservation(1, "2026-09-20T14:00:00-03:00", "2026-09-20T17:00:00-03:00"),
      ],
      requestedStartAt: new Date("2026-09-20T21:00:00-03:00"),
      requestedEndAt: new Date("2026-09-21T00:00:00-03:00"),
      requestedQuantity: 3,
    }),
  );

  expect(result.availableUnits.map((unit) => unit.identifier)).toContain("Robo 01");
  expect(result.isAvailable).toBe(true);
});
```

- [ ] **Step 2: Run the availability suite**

Run: `cd api && npm test -- src/domain/availability/availability.service.test.ts`

Expected: PASS. If it fails, update only `AvailabilityService` to preserve `[start, end)` interval logic.

- [ ] **Step 3: Commit**

```bash
git add api/src/domain/availability
git commit -m "test: cover real same-day robot rental scenario"
```

## Task 3: Generic Prisma Schema

**Files:**

- Modify: `api/prisma/schema.prisma`
- Create: `api/prisma/seed.ts`
- Modify: `api/package.json`

- [ ] **Step 1: Replace the schema with the generic rental domain**

The schema must include `User`, `Category`, `Product`, `ProductUnit`, `Customer`, `Employee`, `Rental`, `RentalItem`, `RentalItemUnit`, `RentalEmployee`, `EquipmentReservation`, `Payment`, `RentalRequest`, `RentalRequestProduct`, `MaintenanceRecord`, and `AuditLog`.

Important field choices:

- `Rental.startAt DateTime`
- `Rental.endAt DateTime`
- `Rental.finalAmountCents Int`
- `Payment.amountCents Int`
- no persisted `remainingAmount`
- `Product.trackIndividualUnits Boolean`
- `ProductUnit.identifier String`
- `EquipmentReservation.blockedFrom DateTime`
- `EquipmentReservation.blockedUntil DateTime`

- [ ] **Step 2: Validate Prisma schema**

Run: `cd api && npx prisma validate`

Expected: schema is valid.

- [ ] **Step 3: Add seed command**

Add to `api/package.json`:

```json
"prisma": {
  "seed": "ts-node prisma/seed.ts"
}
```

- [ ] **Step 4: Create seed data**

Seed must create:

- one admin user;
- category `Robos`;
- product `Robo LED` with `trackIndividualUnits = true`;
- units `Robo 01` through `Robo 08`;
- category `Equipamentos LED`;
- product `Balanco LED` with `trackIndividualUnits = true`;
- unit `Balanco LED 01`;
- employees `Carlos`, `Lucas`, `Pedro`.

- [ ] **Step 5: Commit**

```bash
git add api/prisma/schema.prisma api/prisma/seed.ts api/package.json api/package-lock.json
git commit -m "feat: add generic rental prisma schema"
```

## Task 4: Backend Rental API Slice

**Files:**

- Create: `api/src/schemas/rental.schemas.ts`
- Create: `api/src/repositories/rental.repository.ts`
- Create: `api/src/repositories/product.repository.ts`
- Create: `api/src/repositories/payment.repository.ts`
- Create: `api/src/services/rental.service.ts`
- Create: `api/src/controllers/rental.controller.ts`
- Create: `api/src/routes/rental.routes.ts`
- Modify: `api/src/routes/index.js` or migrate router entry to TypeScript.

- [ ] **Step 1: Write service tests first**

Create tests proving:

- creating a rental requires `startAt`, `endAt`, responsible/customer data, final amount, at least one product, and one employee;
- confirming a rental creates `EquipmentReservation`;
- adding confirmed payments changes calculated received/remaining values;
- overlapping same unit is rejected.

- [ ] **Step 2: Run tests and watch them fail**

Run: `cd api && npm test -- src/services/rental.service.test.ts`

Expected: FAIL because service files do not exist.

- [ ] **Step 3: Implement repositories and service**

Implement service methods:

- `createDraftRental`
- `confirmRental`
- `addPayment`
- `getRentalById`
- `listRentals`
- `listCalendarEvents`
- `getMonthlyReport`

- [ ] **Step 4: Run tests**

Run: `cd api && npm test`

Expected: all backend tests pass.

- [ ] **Step 5: Commit**

```bash
git add api/src
git commit -m "feat: add rental management api slice"
```

## Task 5: Admin UI MVP

**Files:**

- Create: `app/src/pages/Calendar.jsx`
- Modify: `app/src/pages/Rentals.jsx`
- Modify: `app/src/pages/Reports.jsx`
- Modify: `app/src/App.jsx`
- Modify: `app/src/components/Sidebar.jsx`

- [ ] **Step 1: Add routes and navigation**

Add routes:

- `/admin/calendar`
- `/admin/rentals`
- `/admin/reports`

- [ ] **Step 2: Build rental form**

The rental form must capture:

- event date;
- start time;
- end time;
- responsible name;
- responsible contact;
- charged amount;
- received amount through payments;
- assigned employee;
- selected units.

- [ ] **Step 3: Build calendar**

Calendar events must render rentals using:

- `start = rental.startAt`
- `end = rental.endAt`
- title with customer/responsible name and status.

- [ ] **Step 4: Build monthly report**

Report must show:

- total events in month;
- future events;
- charged amount;
- received amount;
- remaining amount;
- table with date, time, responsible, contact, employee, amount, received, remaining and status;
- print button using `window.print()`.

- [ ] **Step 5: Run frontend checks**

Run:

```bash
cd app
npm run build
```

Expected: build passes.

- [ ] **Step 6: Commit**

```bash
git add app/src
git commit -m "feat: add rental calendar and reports ui"
```

## Self-Review

- Spec coverage: this plan covers the user's immediate requirements and starts the larger migration without claiming the whole product is finished.
- Placeholder scan: no placeholders are used as implementation instructions.
- Type consistency: money uses cents, rental dates use `startAt/endAt`, availability uses `blockedFrom/blockedUntil`.
