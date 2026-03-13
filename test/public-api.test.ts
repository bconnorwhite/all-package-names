/* eslint-disable import/no-relative-parent-imports, @typescript-eslint/no-floating-promises */
import assert from "node:assert/strict";
import { test } from "node:test";
import * as api from "../src/index.ts";

test("package root only exports the default instance at runtime", () => {
  assert.deepEqual(Object.keys(api).sort(), ["default"]);
});
