/* eslint-disable import/no-relative-parent-imports, @typescript-eslint/no-floating-promises */
import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import mock, { restore } from "mock-fs";
import {
  createManifest,
  defaultManifestPath,
  defaultNamesPath,
  readManifest,
  readNamesFile
} from "../src/backend/store.ts";
import { syncNames } from "../src/sync/index.ts";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  restore();
});

test("syncNames uses the default store paths when no options are provided", async () => {
  mock({
    [defaultNamesPath]: JSON.stringify(["alpha"]),
    [defaultManifestPath]: JSON.stringify(createManifest(["alpha"], 10))
  });

  globalThis.fetch = ((input) => {
    const url = typeof input === "string" || input instanceof URL
      ? input.toString()
      : input.url;

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

  const result = await syncNames();

  assert.deepEqual(result, {
    since: 11,
    count: 2,
    added: 1,
    removed: 0,
    processedChanges: 1
  });
  assert.deepEqual(await readNamesFile(defaultNamesPath), ["alpha", "beta"]);
  assert.deepEqual(await readManifest(defaultManifestPath), createManifest(["alpha", "beta"], 11));
});
