/* eslint-disable import/no-relative-parent-imports, @typescript-eslint/no-floating-promises */
import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import mock, { restore } from "mock-fs";
import { createManifest, readManifest, readNamesFile } from "../src/backend/store.ts";
import { syncNames } from "../src/sync/index.ts";
import { writeFixture } from "./helpers.ts";

const namesPath = "/virtual/data/names.json";
const manifestPath = "/virtual/data/manifest.json";
const originalFetch = globalThis.fetch;

beforeEach(() => {
  mock({
    "/virtual/data": {}
  });
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  restore();
});

test("syncNames updates files and returns a summary", async () => {
  await writeFixture(namesPath, manifestPath, ["alpha"], 10);

  globalThis.fetch = ((input) => {
    const url = typeof input === "string" || input instanceof URL
      ? input.toString()
      : input.url;

    if(url === "https://replicate.npmjs.com/") {
      return Promise.resolve({
        status: 200,
        json: () => Promise.resolve({
          update_seq: 11
        })
      } as Response);
    }

    if(url !== "https://replicate.npmjs.com/registry/_changes?since=10&limit=10000") {
      throw new Error(`Unexpected JSON request: ${url}`);
    }

    return Promise.resolve({
      status: 200,
      json: () => Promise.resolve({
        results: [
          { id: "beta", seq: 11 }
        ],
        last_seq: 11
      })
    } as Response);
  }) as typeof fetch;

  const result = await syncNames({
    namesPath,
    manifestPath
  });

  assert.deepEqual(result, {
    since: 11,
    count: 2,
    added: 1,
    removed: 0,
    processedChanges: 1
  });
  assert.deepEqual(await readNamesFile(namesPath), ["alpha", "beta"]);
  assert.deepEqual(await readManifest(manifestPath), createManifest(["alpha", "beta"], 11));
});
