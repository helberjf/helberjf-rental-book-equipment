import test from "node:test";
import assert from "node:assert/strict";
import {
  buildEventDateTime,
  buildEventRange,
  buildRentalItems,
  moneyToCents,
} from "./rental-utils.js";

test("buildEventDateTime converts Sao Paulo event time to UTC", () => {
  assert.equal(
    buildEventDateTime("2026-09-20", "18:00").toISOString(),
    "2026-09-20T21:00:00.000Z",
  );
});

test("buildEventRange rolls an overnight event into the next day", () => {
  const range = buildEventRange("2026-09-20", "22:00", "01:00");
  assert.equal(range.startAt.toISOString(), "2026-09-21T01:00:00.000Z");
  assert.equal(range.endAt.toISOString(), "2026-09-21T04:00:00.000Z");
});

test("moneyToCents converts typed decimal currency safely", () => {
  assert.equal(moneyToCents("1,500.75"), 150075);
  assert.equal(moneyToCents("1500,75"), 150075);
  assert.equal(moneyToCents(""), 0);
});

test("buildRentalItems groups selected equipment units by product", () => {
  const products = [
    { id: 1, units: [{ id: 11 }, { id: 12 }] },
    { id: 2, units: [{ id: 21 }] },
  ];

  assert.deepEqual(buildRentalItems(products, [11, 12, 21]), [
    { productId: 1, quantity: 2, productUnitIds: [11, 12], unitPriceCents: 0 },
    { productId: 2, quantity: 1, productUnitIds: [21], unitPriceCents: 0 },
  ]);
});
