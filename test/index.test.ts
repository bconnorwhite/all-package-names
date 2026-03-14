/* eslint-disable import/no-relative-parent-imports, @typescript-eslint/no-floating-promises */
import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import mock, { restore } from "mock-fs";
import { AllPackageNames } from "../src/backend/index.ts";
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

test("database supports toArray, has, iteration, and iterPrefix", async () => {
  await writeFixture(namesPath, manifestPath, ["react", "react-dom", "read", "@scope/pkg"], 42);

  const index = new AllPackageNames({
    namesPath,
    manifestPath
  });

  assert.deepEqual(await index.toArray(), ["@scope/pkg", "react", "react-dom", "read"]);
  assert.equal(await index.has("react"), true);
  assert.equal(await index.has("missing"), false);

  const iterated: string[] = [];
  for await (const name of index) {
    iterated.push(name);
  }
  assert.deepEqual(iterated, ["@scope/pkg", "react", "react-dom", "read"]);

  const prefixed: string[] = [];
  for await (const name of index.iterPrefix("rea")) {
    prefixed.push(name);
  }
  assert.deepEqual(prefixed, ["react", "react-dom", "read"]);
});

test("refresh rewrites names.json and manifest.json", async () => {
  await writeFixture(namesPath, manifestPath, ["alpha", "beta"], 10);

  globalThis.fetch = ((input) => {
    const url = typeof input === "string" || input instanceof URL
      ? input.toString()
      : input.url;

    if(url === "https://replicate.npmjs.com/") {
      return Promise.resolve({
        status: 200,
        json: () => Promise.resolve({
          update_seq: 13
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
          { id: "beta", seq: 11, deleted: true },
          { id: "gamma", seq: 12 },
          { id: "_design/ignore-me", seq: 13 }
        ],
        last_seq: 13
      })
    } as Response);
  }) as typeof fetch;

  const index = new AllPackageNames({
    namesPath,
    manifestPath
  });

  const refresh = await index.refresh();
  assert.deepEqual(refresh, {
    since: 13,
    count: 2,
    added: 1,
    removed: 1,
    processedChanges: 3
  });
  assert.deepEqual(await index.toArray(), ["alpha", "gamma"]);
  assert.equal(await index.has("beta"), false);
  assert.equal(await index.has("gamma"), true);
});
