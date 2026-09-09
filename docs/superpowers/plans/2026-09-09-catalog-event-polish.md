# Catalog and Event Polish Implementation Plan

> Execute inline with test-driven development and verification-before-completion. The user approved safe deletion and requested staff costs, final notes and animations.

**Goal:** Complete catalog actions, record event-specific staff fees/final notes, and improve mobile marketing and link previews.

**Architecture:** Keep the React/Vite + Express/Prisma stack. Soft deletion sets `active=false` and rejects future/ongoing bookings; history stays linked. Store each agreed fee as `RentalEmployee.costCents` and final notes as `Rental.finalNotes`. Neither changes customer charges or payments.

## 1. Backend lifecycle

- [x] Add failing tests for employee edit validation, safe deletion guards and operations payloads.
- [x] Add PATCH employee and DELETE employee/product endpoints with shared transaction locks. Reject future/ongoing non-cancelled assignments (including drafts), manual staff bookings and active equipment reservations. Never delete historical rows.
- [x] Add additive migration for `costCents Int @default(0)` and nullable `finalNotes`.
- [x] Accept staff fees on creation and authenticated PATCH `/rentals/:id/operations`; reject duplicate/unassigned employee IDs, negative fees and notes over 4000 characters. Update only supplied assigned fees and final notes.
- [x] Include fees in event records and monthly totals. Run API typecheck, tests and build.

## 2. Admin interface

- [x] Put edit/delete actions on each employee/equipment card, retaining existing create forms. Confirmation explains history preservation and cancellation is harmless.
- [x] Add fee inputs for selected employees in the booking form and a separate event operations modal for existing events.
- [x] Show staff fees and final notes in event lists and monthly print reports. Translate every new label/error PT/EN.
- [x] Run frontend lint, tests and build.

## 3. Landing and sharing

- [x] Add static Open Graph/Twitter title, description, canonical URL and publicly accessible robot image in `app/index.html`, readable without JavaScript.
- [x] Install `react-icons` and use `FaWhatsapp` in all WhatsApp CTAs. Keep the first CTA text “Contrate para seu evento”.
- [x] In mobile hero, show headline then a prominent robot image then compact copy and CTA. Eager-load the hero and keep the full costume visible.
- [x] Add restrained entrance/hover animation and disable motion for `prefers-reduced-motion`.
- [x] Test raw HTML metadata, image existence, icon usage and reduced-motion rules. Verify 320/390/1440px layouts in Chrome.

## 4. Verification and release

- [x] Run isolated-database integration: create/edit/delete, future deletion rejection, cost/note persistence and preservation of financial totals/history.
- [x] Run all tests, builds and diff checks; review changes against the approved scope.
- [ ] Merge and push main per the standing user request, verify Vercel deployments and public metadata. Do not reset production credentials or add test data to production.
