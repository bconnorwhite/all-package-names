/* eslint-disable import/no-relative-parent-imports, @typescript-eslint/no-floating-promises */
import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import mock, { restore } from "mock-fs";
import { AllPackageNames } from "../src/backend/index.ts";

beforeEach(() => {
  mock({
    "/virtual/data": {}
  });
});

afterEach(() => {
  restore();
});

test("empty store", async () => {
  const index = new AllPackageNames({
    namesPath: "/virtual/data/names.json",
    manifestPath: "/virtual/data/manifest.json"
  });

  const names: string[] = [];
  for await (const name of index.iterPrefix("re")) {
    names.push(name);
  }

  assert.deepEqual(await index.toArray(), []);
  assert.equal(await index.has("react"), false);
  assert.deepEqual(names, []);
});
