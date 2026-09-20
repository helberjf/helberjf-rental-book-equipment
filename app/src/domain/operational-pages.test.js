import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const page = (name) => readFileSync(new URL(`../pages/${name}.jsx`, import.meta.url), "utf8");

test("calendar combines event and staff schedules and exposes date navigation", () => {
  const source = page("Calendar");

  assert.match(source, /api\.get\("\/api\/calendar\/events"/);
  assert.match(source, /api\.get\('\/api\/staff-bookings'\)/);
  assert.match(source, /getCalendarDays\(month\)/);
  assert.match(source, /Previous month/);
  assert.match(source, /Next month/);
  assert.match(source, /EVENT DETAILS/);
});

test("team management supports employee CRUD and standalone staff reservations", () => {
  const source = page("Team");

  assert.match(source, /api\.get\('\/api\/employees'\)/);
  assert.match(source, /api\.get\('\/api\/staff-bookings'\)/);
  assert.match(source, /api\.post\('\/api\/staff-bookings'/);
  assert.ok(source.includes("api.delete(`/api/staff-bookings/${id}`"));
  assert.ok(source.includes("api.delete(`/api/employees/${employee.id}`"));
  assert.match(source, /window\.confirm/);
  assert.match(source, /buildEventRange\(form\.date, form\.startTime, form\.endTime\)/);
});

test("equipment management parses multiple identifiers and protects editing identifiers", () => {
  const source = page("Equipment");

  assert.match(source, /api\.get\('\/api\/products'\)/);
  assert.match(source, /identifiers\.split\(\/\\n\|,\/\)/);
  assert.match(source, /disabled=\{Boolean\(editing\)\}/);
  assert.match(source, /api\.post\('\/api\/products'/);
  assert.match(source, /api\.patch\(`\/api\/products\/\$\{editing\}`/);
  assert.match(source, /api\.delete\(`\/api\/products\/\$\{product\.id\}`/);
});

test("event management derives time, equipment, staff and payment payloads", () => {
  const source = page("Rentals");

  assert.match(source, /buildEventRange\(form\.date, form\.startTime, form\.endTime\)/);
  assert.match(source, /buildRentalItems\(products, form\.selectedUnitIds\)/);
  assert.match(source, /moneyToCents\(form\.receivedAmount\)/);
  assert.match(source, /employeeFees/);
  assert.match(source, /initialPayment/);
  assert.ok(source.includes("api.post(`/api/rentals/${paymentRental.id}/payments`"));
});

test("reports load a selected month and expose financial totals and printing", () => {
  const source = page("Reports");

  assert.match(source, /api\.get\("\/api\/reports\/monthly"/);
  assert.match(source, /params:\s*\{\s*month\s*\}/);
  assert.match(source, /window\.print\(\)/);
  assert.match(source, /chargedAmountCents/);
  assert.match(source, /receivedAmountCents/);
  assert.match(source, /remainingAmountCents/);
  assert.match(source, /staffCostCents/);
});
