/* eslint-disable import/no-relative-parent-imports, @typescript-eslint/no-floating-promises */
import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import mock, { restore } from "mock-fs";
import { createManifest, readManifest, readNamesFile } from "../src/backend/store.ts";

beforeEach(() => {
  mock({
    "/virtual/data": {
      "names.json": "{}",
      "manifest.json": "{\"since\":\"nope\",\"count\":\"nope\",\"namesSha256\":null}"
    }
  });
});

afterEach(() => {
  restore();
});

test("invalid files fall back to empty values", async () => {
  assert.deepEqual(await readNamesFile("/virtual/data/names.json"), []);
  assert.deepEqual(await readManifest("/virtual/data/manifest.json"), createManifest([], 0));
});
