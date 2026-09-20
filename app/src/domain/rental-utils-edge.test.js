import test from "node:test";
import assert from "node:assert/strict";
import {
  buildEventDateTime,
  buildEventRange,
  buildRentalItems,
  formatCurrency,
  getCalendarDays,
  moneyToCents,
  toLocalDateKey,
} from "./rental-utils.js";

test("buildEventDateTime rejects an invalid time", () => {
  assert.throws(
    () => buildEventDateTime("2026-09-20", "not-a-time"),
    /Invalid event date or time/,
  );
});

test("buildEventRange keeps a same-day event on the original date", () => {
  const range = buildEventRange("2026-09-20", "14:00", "18:00");

  assert.equal(range.startAt.toISOString(), "2026-09-20T17:00:00.000Z");
  assert.equal(range.endAt.toISOString(), "2026-09-20T21:00:00.000Z");
});

test("moneyToCents accepts Brazilian currency formatting and negative values", () => {
  assert.equal(moneyToCents("R$ 1.234,56"), 123456);
  assert.equal(moneyToCents("-12,50"), -1250);
});

test("buildRentalItems ignores unknown and duplicate selected unit ids", () => {
  const products = [{
    id: 1,
    defaultRateCents: 25000,
    units: [{ id: 11 }, { id: 12 }],
  }];

  assert.deepEqual(buildRentalItems(products, ["11", "11", 999]), [
    {
      productId: 1,
      quantity: 1,
      productUnitIds: [11],
      unitPriceCents: 25000,
    },
  ]);
});

test("getCalendarDays returns a six-week Monday-first grid", () => {
  const days = getCalendarDays("2026-02");

  assert.equal(days.length, 42);
  assert.equal(days[0].key, "2026-01-26");
  assert.equal(days.at(-1).key, "2026-03-08");
  assert.equal(days.filter((day) => day.currentMonth).length, 28);
});

test("toLocalDateKey uses Sao Paulo date instead of UTC date", () => {
  assert.equal(toLocalDateKey("2026-09-20T02:30:00.000Z"), "2026-09-19");
});

test("formatCurrency formats cents as Brazilian reais by default", () => {
  const formatted = formatCurrency(12345);

  assert.match(formatted, /123,45/);
  assert.match(formatted, /R\$/);
});
