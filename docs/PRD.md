# Product Requirements Document

## Rental Book Equipment

**Status:** Active product direction

**Audience:** Product, design, engineering, operations, and hiring reviewers

**Document purpose:** Keep the business problem, product scope, user experience, and engineering priorities aligned while the rental platform evolves.

## 1. Product summary

Rental Book Equipment is an operations platform for companies that rent equipment and services for events. It helps an operator register physical equipment, manage staff, create event bookings, prevent schedule conflicts, track payments, and understand upcoming work.

The initial business context is event equipment such as LED robots and an LED swing. The product model must remain generic enough to support other rentable assets, including audiovisual equipment, furniture, tools, costumes, bikes, and vehicles.

The product is not only an inventory CRUD system. Its core value is coordinating scarce physical resources and people across time-bound events.

## 2. Problem statement

Rental operations become unreliable when availability is managed with spreadsheets, messages, or date-only stock counts. Operators need to answer questions such as:

- Is this exact physical unit available for the requested time window?
- Is an employee already committed to another event?
- What equipment and staff are assigned to an upcoming event?
- How much has the customer paid and what remains outstanding?
- Which events and operational costs belong to a given month?

The system must turn these questions into one operational source of truth.

## 3. Product vision

Give a rental operator a fast, trustworthy workspace for turning an event request into a confirmed, staffed, paid, and operationally visible booking.

The desired experience is:

```text
Request -> availability check -> event booking -> staff/equipment assignment
         -> payment tracking -> calendar/reporting -> event delivery
```

## 4. Product principles

1. **Time is first-class data.** Availability must use start and end timestamps, not only a calendar date.
2. **Physical units matter.** The product type and the exact rentable unit must be distinguishable.
3. **The backend is the source of truth.** Interfaces can suggest availability, but confirmation must be validated by the API.
4. **Operators come first.** The most important workflow is fast and safe internal event management.
5. **Be explicit about product maturity.** Implemented behavior, inherited foundation, and roadmap items must remain visibly separate.
6. **Keep the domain generic.** LED equipment is seed data, not a hard-coded product rule.

## 5. Users and needs

### 5.1 Rental operator / administrator

Needs to configure the catalog, create and edit events, assign staff and equipment, record payments, resolve conflicts, and monitor the month.

### 5.2 Event team member

Needs to know which events they are assigned to and when they are unavailable for another commitment.

### 5.3 Customer or event requester

Needs a clear way to describe an event and request a quote. A public request should not become a confirmed booking without internal validation.

### 5.4 Business owner

Needs visibility into revenue, outstanding amounts, upcoming events, operational workload, and equipment utilization.

## 6. Goals and non-goals

### Goals

- Maintain a reliable catalog of rentable products and physical units.
- Create event bookings with precise date and time windows.
- Prevent overlapping equipment and staff commitments.
- Make assigned resources visible before the event.
- Track charged, received, and remaining amounts.
- Support calendar, dashboard, and printable monthly operations.
- Provide a foundation for public quote requests.

### Non-goals for the current product direction

- Direct, automatically confirmed public bookings without operator approval.
- A full accounting system or tax platform.
- General-purpose ERP functionality.
- Replacing every inherited module before the event workflow is reliable.
- Hard-coding the product around only LED equipment.

## 7. Core user journeys

### Journey A — Configure equipment

1. The administrator creates a product or equipment category.
2. The administrator registers each physical unit with a unique identifier.
3. The administrator records operational details such as dimensions, status, and rental price.
4. The unit becomes selectable only when it is active and available.

### Journey B — Configure the team

1. The administrator creates or edits an employee.
2. The administrator can record independent staff reservations.
3. The system rejects a conflicting staff commitment.
4. Historical assignments remain available for operational context.

### Journey C — Create an event booking

1. The operator selects the event date and start/end time.
2. The operator enters the responsible person, contact, venue, and notes.
3. The operator selects equipment units and assigned employees.
4. The system validates equipment and staff availability.
5. The operator records the price, received amount, and remaining balance.
6. The booking appears on the operational calendar.

### Journey D — Operate the month

1. The operator opens the calendar or upcoming-event view.
2. The operator reviews event timing, customer, staff, equipment, and payment state.
3. The operator filters the monthly report.
4. The operator prints or saves the report for operational use.

### Journey E — Handle a public request

1. A customer views the public presentation and available service context.
2. The customer submits a quote request with event details.
3. The operator reviews the request and checks real availability.
4. The operator converts the request into an event booking only after validation.

## 8. Functional requirements

Status values:

- **Implemented:** represented in the current product baseline.
- **In progress:** partially represented or being refined.
- **Planned:** required for the target workflow but not yet complete.

| ID | Requirement | Priority | Status |
| --- | --- | --- | --- |
| FR-01 | Manage products and physical equipment units with unique identifiers. | Must | Implemented |
| FR-02 | Register, edit, assign, and reserve employees. | Must | Implemented |
| FR-03 | Create event bookings with date, start time, end time, contact, venue, notes, and assigned resources. | Must | Implemented |
| FR-04 | Validate equipment conflicts using precise blocked intervals. | Must | Implemented |
| FR-05 | Validate employee conflicts for event and independent staff reservations. | Must | Implemented |
| FR-06 | Calculate suggested booking price and allow an authorized manual override. | Must | Implemented |
| FR-07 | Track charged, received, and remaining amounts. | Must | Implemented |
| FR-08 | Display upcoming events and event details in an administrative calendar. | Must | Implemented |
| FR-09 | Produce monthly operational totals and a print-friendly report. | Should | Implemented |
| FR-10 | Provide Portuguese/English administration and responsive mobile layouts. | Should | Implemented |
| FR-11 | Provide a public quote-request flow that does not confirm a booking directly. | Should | Planned |
| FR-12 | Protect final confirmation against concurrent double-booking at the persistence boundary. | Must | In progress |
| FR-13 | Preserve operational history when equipment or employees are edited or retired. | Should | In progress |
| FR-14 | Provide isolated workflow verification against a disposable test schema. | Should | Implemented |

## 9. Business rules

### 9.1 Equipment availability

Two blocked intervals conflict when:

```text
existing.blockedFrom < requested.blockedUntil
AND
existing.blockedUntil > requested.blockedFrom
```

Intervals use `[start, end)` semantics. The start is inclusive and the end is exclusive.

Therefore:

```text
Event A: 2026-09-20 14:00 -> 17:00
Event B: 2026-09-20 17:00 -> 19:00
Result: allowed when no buffer is configured
```

If a product requires preparation, transport, cleaning, or teardown time, the blocked window must include the configured buffer.

### 9.2 Equipment state

A unit cannot be selected when it is inactive, damaged, lost, under maintenance, or already reserved in the requested window.

### 9.3 Staff availability

An employee cannot be assigned to overlapping event or independent staff reservations. The validation must use the same time-window principle as equipment.

### 9.4 Financial state

The remaining amount is derived from the charged amount and received payments. It should not be manually entered as an independent source of truth.

### 9.5 Confirmation boundary

The interface may show suggestions, but the API must revalidate all equipment and staff assignments during final confirmation. Persistence-level concurrency protection is required before describing the system as safe for simultaneous production confirmations.

## 10. Experience requirements

- The operator should reach “create event” from the dashboard or calendar without searching through unrelated legacy modules.
- Conflict feedback should identify the resource and reason, not only say that the booking failed.
- The calendar should make future events, assigned staff, equipment, and payment state easy to scan.
- Forms should preserve user-entered names and notes exactly as entered.
- Portuguese/English switching should not change stored business data.
- Mobile views should support the operational tasks most likely to happen at an event venue.
- Printed reports should remain legible without requiring application-specific software.

## 11. Data model direction

The target domain should make these concepts explicit:

```text
User
Product -> ProductUnit
Customer
Employee
Rental/Event -> RentalItem -> RentalItemUnit
EquipmentReservation
StaffReservation
Payment
MaintenanceRecord
QuoteRequest
```

The exact schema can evolve, but the relationships must preserve the distinction between a product type, a physical unit, a booking, a payment, and a time-based reservation.

## 12. Non-functional requirements

- Authentication and authorization must protect administrative operations.
- The API must validate input and return actionable errors.
- PostgreSQL remains the persistence target for operational data.
- Migrations and seed data must be repeatable for a new environment.
- The API and frontend must expose typecheck, test, lint, or build commands appropriate to each package.
- Production deployment must not reset custom equipment, staff, bookings, payments, or credentials unexpectedly.
- Test workflow scripts must run only against a disposable database schema.
- The system should remain usable on mobile devices at event venues.

## 13. Success measures

The product direction is successful when:

- an operator can create a complete event without spreadsheets;
- an exact unit is never presented as available when its blocked interval conflicts;
- staff conflicts are identified before confirmation;
- the operator can see upcoming events, assignments, and outstanding balances in one place;
- a monthly report can be printed and reconciled with the event list;
- a new equipment category can be added without changing domain rules;
- a new developer or recruiter can understand the product direction from the repository documentation.

## 14. Delivery roadmap

### Current baseline

The current product baseline includes the admin workflow for equipment, team, event operations, calendar, dashboard, reports, payments, authentication, bilingual administration, responsive layouts, and a public marketing surface.

### Next increment

1. Finish the public quote-request flow.
2. Complete persistence-level concurrency protection for final confirmation.
3. Expand API and browser-level workflow coverage.
4. Add CI for API tests, typechecking, frontend tests, lint, and builds.
5. Publish a safe demo environment with seeded sample data and a short guided walkthrough.

### Later

- utilization and profitability analytics;
- exportable operational data;
- customer history and repeat-event workflows;
- notifications and reminders;
- deeper audit and role permissions.

## 15. Risks and decisions to revisit

| Risk | Why it matters | Mitigation |
| --- | --- | --- |
| Timezone ambiguity | Event dates and times can be interpreted differently by the API, database, and browser. | Define one business timezone and test date serialization explicitly. |
| Concurrent confirmations | Two operators could select the same unit at nearly the same time. | Revalidate inside a transaction and add persistence-level protection. |
| Legacy modules | Inherited screens can obscure the target event workflow. | Keep migration boundaries documented and prioritize operator journeys. |
| Seed data misuse | Demo credentials or sample values must not leak into production. | Separate disposable seed data from production provisioning and document it. |
| Public promise vs internal truth | A public quote request must not imply confirmed availability. | Keep quote requests separate from administrative confirmation. |

## 16. Definition of done for the target MVP

The target MVP is ready for a real operational pilot when an authorized operator can:

1. register products, physical units, customers, and employees;
2. create an event with a precise time window;
3. select equipment and staff with conflict validation;
4. confirm the event without concurrent double-booking;
5. record payments and see the remaining amount;
6. find the event in the calendar and monthly report;
7. operate the workflow on desktop and mobile;
8. recover safely from invalid input or unavailable resources;
9. run the documented test, typecheck, build, and workflow verification commands.

## Resumo em português

O produto é um sistema de operação para empresas que alugam equipamentos e serviços para eventos. O foco não é apenas cadastrar produtos, mas coordenar unidades físicas, funcionários, horários, pagamentos e relatórios.

O principal requisito de negócio é controlar disponibilidade por intervalo de tempo. Um equipamento pode ser usado em dois eventos no mesmo dia se os horários não se sobrepõem; uma reserva só deve ser confirmada depois que a API validar novamente os recursos.

O PRD organiza:

- problema e visão do produto;
- usuários e jornadas principais;
- funcionalidades obrigatórias e desejáveis;
- regras de disponibilidade, equipe e pagamentos;
- requisitos de experiência e arquitetura;
- métricas, riscos, roadmap e critérios de aceite.

Este documento deve ser atualizado conforme as decisões do produto mudarem. Ele serve como direção compartilhada, não como uma especificação rígida de cada detalhe visual ou de implementação.
