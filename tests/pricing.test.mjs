import test from "node:test";
import assert from "node:assert/strict";
import { getPriceUsd, listEndpoints } from "../server/pricing.js";

test("lists the expected paywalled endpoints", () => {
  const endpoints = listEndpoints().map((endpoint) => endpoint.id);
  assert.deepEqual(endpoints, ["ai", "data", "compute"]);
});

test("keeps base pricing for short queries", () => {
  assert.equal(getPriceUsd("ai", "short"), "0.02");
  assert.equal(getPriceUsd("data", "facts"), "0.01");
});

test("adds a complexity surcharge for longer queries", () => {
  assert.equal(getPriceUsd("compute", "this is a very long compute query"), "0.04");
});
