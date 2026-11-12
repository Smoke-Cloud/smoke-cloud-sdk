import { test } from "node:test";
import assert from "node:assert/strict";
import {
  coresToInstance,
  isCoreCount,
  MAX_CORES,
  type NCores,
} from "./coreTypes.ts";

test("every core count from 1 to 32 has an instance type", () => {
  assert.equal(MAX_CORES, 32);
  for (let n = 1; n <= MAX_CORES; n++) {
    assert.ok(isCoreCount(n));
    assert.equal(coresToInstance(n as NCores), `Cores${n}`);
  }
});

test("core counts outside 1 to 32 are rejected", () => {
  for (const n of [0, 33, 2.5, -1, NaN]) {
    assert.equal(isCoreCount(n), false);
    assert.throws(() => coresToInstance(n as NCores), RangeError);
  }
});
