import test from "node:test";
import assert from "node:assert/strict";
import { getApiError } from "../services/errors.js";
import { getLanguage, getLocale, t } from "./language.js";

test("language defaults to Brazilian Portuguese in a non-browser test environment", () => {
  assert.equal(getLanguage(), "pt-BR");
  assert.equal(getLocale(), "pt-BR");
});

test("translation returns the Portuguese label for known operational text", () => {
  assert.equal(t("Calendar"), "Calendário");
  assert.equal(t("Remaining"), "Restante");
});

test("translation preserves unknown text as a safe fallback", () => {
  assert.equal(t("A future label"), "A future label");
});

test("API errors use translated messages when a backend response exists", () => {
  assert.equal(
    getApiError({ response: { data: { message: "Employee saved." } } }),
    "Funcionário salvo.",
  );
});

test("API errors use the generic request message when no response exists", () => {
  assert.equal(getApiError(new Error("network failure")), "Não foi possível concluir a solicitação.");
});
