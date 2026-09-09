import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pt } from './translations.js';

test('Portuguese dictionary covers main operational labels', () => {
  for (const label of ['New employee','Reserve employee','Weight (kg)','Default rental price','System language','Print report','Amount charged','Amount received','Remaining']) assert.ok(pt[label], label);
});

test('localization never translates API enum values or status comparisons', () => {
  for (const page of ['Rentals','Calendar']) {
    const source = readFileSync(new URL(`../pages/${page}.jsx`, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /(?:status\s*:|status\s*[!=]==?)\s*t\(/);
  }
});
