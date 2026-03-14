/* eslint-disable import/no-relative-parent-imports, @typescript-eslint/no-floating-promises */
import assert from "node:assert/strict";
import { test } from "node:test";
import * as api from "../src/index.ts";

test("package root exports the default instance and named sync helpers at runtime", () => {
  assert.deepEqual(Object.keys(api).sort(), ["bootstrapNames", "default", "syncNames"]);
});
