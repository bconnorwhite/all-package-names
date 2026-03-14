/* eslint-disable import/no-relative-parent-imports, @typescript-eslint/no-floating-promises */
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { readFile } from "node:fs/promises";
import { afterEach, test } from "node:test";
import mock, { restore } from "mock-fs";
import {
  fetchReleasePackage,
  fetchChangesSince,
  fetchReplicationHead,
  seedNamesFromReleaseAssets
} from "../src/sync/registry.ts";
import { createReleasePackageBuffer } from "./helpers.ts";

const originalFetch = globalThis.fetch;
const packageJsonPath = fileURLToPath(new URL("../package.json", import.meta.url));

function jsonResponse(status: number, body: unknown) {
  return {
    status,
    json: () => Promise.resolve(body)
  } as Response;
}

function bufferResponse(status: number, body: Buffer) {
  return {
    status,
    arrayBuffer: () => Promise.resolve(body.buffer.slice(
      body.byteOffset,
      body.byteOffset + body.byteLength
    ))
  } as Response;
}

function getUrl(input: string | URL | Request) {
  return typeof input === "string" || input instanceof URL
    ? input.toString()
    : input.url;
}

async function getReleaseAssetUrl() {
  const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8")) as {
    name: string;
    version: string;
  };
  const safeName = packageJson.name.startsWith("@")
    ? packageJson.name.slice(1).replace(/\//g, "-")
    : packageJson.name;
  return {
    url: `https://github.com/bconnorwhite/all-package-names/releases/download/v${packageJson.version}/${safeName}-${packageJson.version}.tgz`,
    version: packageJson.version
  };
}

afterEach(() => {
  globalThis.fetch = originalFetch;
  restore();
});

test("fetchReplicationHead parses string sequences", async () => {
  globalThis.fetch = ((input) => {
    assert.equal(getUrl(input), "https://replicate.npmjs.com/");
    return Promise.resolve(jsonResponse(200, {
      update_seq: "42"
    }));
  }) as typeof fetch;

  assert.equal(await fetchReplicationHead(), 42);
});

test("fetchReplicationHead throws for HTTP errors", async () => {
  globalThis.fetch = (() => Promise.resolve(jsonResponse(503, {
    update_seq: 0
  }))) as typeof fetch;

  await assert.rejects(fetchReplicationHead(), /Could not fetch replication head \(503\)/);
});

test("fetchChangesSince paginates and coalesces create/delete changes", async () => {
  const progress: unknown[] = [];
  const firstPage = [
    { id: "alpha", seq: 11 },
    { id: "beta", seq: 12, deleted: true },
    { id: "beta", seq: 13 },
    ...Array.from({ length: 9997 }, (_, index) => ({
      id: `_ignored/${String(index)}`,
      seq: 14 + index
    }))
  ];

  globalThis.fetch = ((input) => {
    const url = getUrl(input);

    if(url === "https://replicate.npmjs.com/") {
      return Promise.resolve(jsonResponse(200, {
        update_seq: 20000
      }));
    }

    if(url === "https://replicate.npmjs.com/registry/_changes?since=10&limit=10000") {
      return Promise.resolve(jsonResponse(200, {
        results: firstPage,
        last_seq: 10010
      }));
    }

    if(url === "https://replicate.npmjs.com/registry/_changes?since=10010&limit=10000") {
      return Promise.resolve(jsonResponse(200, {
        results: [
          { id: "alpha", seq: 10011, deleted: true },
          { id: "beta", seq: 10012 },
          { id: "_design/ignored", seq: 10013 }
        ],
        last_seq: "10013"
      }));
    }

    throw new Error(`Unexpected JSON request: ${url}`);
  }) as typeof fetch;

  const result = await fetchChangesSince(10, {
    onProgress(value) {
      progress.push(value);
    }
  });

  assert.equal(result.since, 10013);
  assert.equal(result.processedChanges, 10003);
  assert.deepEqual([...result.created], ["beta"]);
  assert.deepEqual([...result.deleted], ["alpha"]);
  assert.deepEqual(progress, [
    {
      phase: "changes",
      startSince: 10,
      currentSince: 10,
      targetSince: 20000,
      processedChanges: 0
    },
    {
      phase: "changes",
      startSince: 10,
      currentSince: 10010,
      targetSince: 20000,
      processedChanges: 10000
    },
    {
      phase: "changes",
      startSince: 10,
      currentSince: 10013,
      targetSince: 20000,
      processedChanges: 10003
    }
  ]);
});

test("fetchChangesSince throws when the response is malformed", async () => {
  globalThis.fetch = ((input) => {
    const url = getUrl(input);

    if(url === "https://replicate.npmjs.com/") {
      return Promise.resolve(jsonResponse(200, {
        update_seq: 1
      }));
    }

    return Promise.resolve(jsonResponse(200, {
      results: null,
      last_seq: 1
    }));
  }) as typeof fetch;

  await assert.rejects(fetchChangesSince(0), /Replication feed response did not include results/);
});

test("fetchChangesSince throws for HTTP errors", async () => {
  globalThis.fetch = ((input) => {
    const url = getUrl(input);

    if(url === "https://replicate.npmjs.com/") {
      return Promise.resolve(jsonResponse(200, {
        update_seq: 0
      }));
    }

    return Promise.resolve(jsonResponse(500, {
      results: [],
      last_seq: 0
    }));
  }) as typeof fetch;

  await assert.rejects(fetchChangesSince(0), /Could not fetch replication changes \(500\)/);
});

test("seedNamesFromReleaseAssets downloads and validates the release package", async () => {
  const { url: releaseAssetUrl, version } = await getReleaseAssetUrl();
  const releaseAsset = await createReleasePackageBuffer(version, ["react", "read"], 123);

  globalThis.fetch = ((input) => {
    const url = getUrl(input);

    if(url === releaseAssetUrl) {
      return Promise.resolve(bufferResponse(200, releaseAsset));
    }

    throw new Error(`Unexpected request: ${url}`);
  }) as typeof fetch;

  const result = await seedNamesFromReleaseAssets();

  assert.equal(result.since, 123);
  assert.deepEqual([...result.names].sort(), ["react", "read"]);
});

test("fetchReleasePackage downloads the current version package", async () => {
  const { url: releaseAssetUrl, version } = await getReleaseAssetUrl();
  const releaseAsset = await createReleasePackageBuffer(version, ["react", "read"], 123);

  globalThis.fetch = ((input) => {
    const url = getUrl(input);

    if(url === releaseAssetUrl) {
      return Promise.resolve(bufferResponse(200, releaseAsset));
    }

    throw new Error(`Unexpected request: ${url}`);
  }) as typeof fetch;

  const result = await fetchReleasePackage("current");

  assert.equal(result.version, version);
  assert.equal(result.since, 123);
  assert.deepEqual([...result.names].sort(), ["react", "read"]);
});

test("seedNamesFromReleaseAssets falls back to _all_docs when the release package is invalid", async () => {
  const { url: releaseAssetUrl, version } = await getReleaseAssetUrl();
  const releaseAsset = await createReleasePackageBuffer(version, ["react"], 123, {
    manifest: {
      namesSha256: "invalid"
    }
  });
  const progress: unknown[] = [];

  globalThis.fetch = ((input) => {
    const url = getUrl(input);

    if(url === releaseAssetUrl) {
      return Promise.resolve(bufferResponse(200, releaseAsset));
    }

    if(url === "https://replicate.npmjs.com/registry/_all_docs?limit=10000") {
      return Promise.resolve(jsonResponse(200, {
        total_rows: 3,
        rows: [
          { id: "alpha" },
          { id: "_design/ignored" },
          { id: "beta" }
        ]
      }));
    }

    if(url === "https://replicate.npmjs.com/registry/_all_docs?limit=10000&startkey=%22beta%22") {
      return Promise.resolve(jsonResponse(200, {
        rows: [
          { id: "beta" }
        ]
      }));
    }

    if(url === "https://replicate.npmjs.com/") {
      return Promise.resolve(jsonResponse(200, {
        update_seq: "456"
      }));
    }

    throw new Error(`Unexpected request: ${url}`);
  }) as typeof fetch;

  const result = await seedNamesFromReleaseAssets({
    onProgress(value) {
      progress.push(value);
    }
  });

  assert.equal(result.since, 456);
  assert.deepEqual([...result.names], ["alpha", "beta"]);
  assert.deepEqual(progress, [
    {
      phase: "all_docs",
      processedRows: 3,
      syncedNames: 2,
      totalRows: 3
    }
  ]);
});

test("seedNamesFromReleaseAssets falls back to _all_docs when the release package is missing", async () => {
  const { url: releaseAssetUrl } = await getReleaseAssetUrl();

  globalThis.fetch = ((input) => {
    const url = getUrl(input);

    if(url === releaseAssetUrl) {
      return Promise.resolve(jsonResponse(404, {
        message: "Not Found"
      }));
    }

    if(url === "https://replicate.npmjs.com/registry/_all_docs?limit=10000") {
      return Promise.resolve(jsonResponse(200, {
        rows: [
          { id: "alpha" },
          { id: "_design/ignored" },
          { id: "beta" }
        ]
      }));
    }

    if(url === "https://replicate.npmjs.com/registry/_all_docs?limit=10000&startkey=%22beta%22") {
      return Promise.resolve(jsonResponse(200, {
        rows: [
          { id: "beta" }
        ]
      }));
    }

    if(url === "https://replicate.npmjs.com/") {
      return Promise.resolve(jsonResponse(200, {
        update_seq: 789
      }));
    }

    throw new Error(`Unexpected request: ${url}`);
  }) as typeof fetch;

  const result = await seedNamesFromReleaseAssets();

  assert.equal(result.since, 789);
  assert.deepEqual([...result.names], ["alpha", "beta"]);
});

test("seedNamesFromReleaseAssets falls back to _all_docs when the package version is invalid", async () => {
  mock({
    [packageJsonPath]: JSON.stringify({
      name: "all-package-names",
      version: ""
    })
  });

  globalThis.fetch = ((input) => {
    const url = getUrl(input);

    if(url === "https://replicate.npmjs.com/registry/_all_docs?limit=10000") {
      return Promise.resolve(jsonResponse(200, {
        rows: [
          { id: "alpha" }
        ]
      }));
    }

    if(url === "https://replicate.npmjs.com/registry/_all_docs?limit=10000&startkey=%22alpha%22") {
      return Promise.resolve(jsonResponse(200, {
        rows: [
          { id: "alpha" }
        ]
      }));
    }

    if(url === "https://replicate.npmjs.com/") {
      return Promise.resolve(jsonResponse(200, {
        update_seq: 321
      }));
    }

    throw new Error(`Unexpected request: ${url}`);
  }) as typeof fetch;

  const result = await seedNamesFromReleaseAssets();

  assert.equal(result.since, 321);
  assert.deepEqual([...result.names], ["alpha"]);
});

test("seedNamesFromReleaseAssets propagates _all_docs failures", async () => {
  const { url: releaseAssetUrl } = await getReleaseAssetUrl();

  globalThis.fetch = ((input) => {
    const url = getUrl(input);

    if(url === releaseAssetUrl) {
      return Promise.resolve(jsonResponse(404, {
        message: "Not Found"
      }));
    }

    if(url === "https://replicate.npmjs.com/registry/_all_docs?limit=10000") {
      return Promise.resolve(jsonResponse(500, {
        rows: []
      }));
    }

    throw new Error(`Unexpected request: ${url}`);
  }) as typeof fetch;

  await assert.rejects(seedNamesFromReleaseAssets(), /Could not fetch _all_docs bootstrap \(500\)/);
});

test("seedNamesFromReleaseAssets accepts empty _all_docs pages", async () => {
  const { url: releaseAssetUrl } = await getReleaseAssetUrl();

  globalThis.fetch = ((input) => {
    const url = getUrl(input);

    if(url === releaseAssetUrl) {
      return Promise.resolve(jsonResponse(404, {
        message: "Not Found"
      }));
    }

    if(url === "https://replicate.npmjs.com/registry/_all_docs?limit=10000") {
      return Promise.resolve(jsonResponse(200, {
        rows: []
      }));
    }

    if(url === "https://replicate.npmjs.com/") {
      return Promise.resolve(jsonResponse(200, {
        update_seq: 654
      }));
    }

    throw new Error(`Unexpected request: ${url}`);
  }) as typeof fetch;

  const result = await seedNamesFromReleaseAssets();

  assert.equal(result.since, 654);
  assert.deepEqual([...result.names], []);
});
