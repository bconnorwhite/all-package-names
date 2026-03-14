/* eslint-disable import/no-relative-parent-imports, @typescript-eslint/no-floating-promises */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { afterEach, test } from "node:test";
import { fileURLToPath } from "node:url";
import mock, { restore } from "mock-fs";
import cli, {
  bootstrapCommand,
  hasCommand,
  streamPackageNames,
  syncCommand
} from "../src/bin/index.ts";
import {
  createManifest,
  defaultManifestPath,
  defaultNamesPath,
  readManifest,
  readNamesFile
} from "../src/backend/store.ts";
import { createReleasePackageBuffer } from "./helpers.ts";

const originalFetch = globalThis.fetch;
const latestReleaseUrl = "https://api.github.com/repos/bconnorwhite/all-package-names/releases?per_page=1";
const packageJsonPath = fileURLToPath(new URL("../package.json", import.meta.url));
const packageJsonTextPromise = readFile(packageJsonPath, "utf8");

afterEach(() => {
  globalThis.fetch = originalFetch;
  restore();
});

test("base command streams every package name newline-delimited", async () => {
  mock({
    [defaultNamesPath]: JSON.stringify(["alpha", "beta"]),
    [defaultManifestPath]: JSON.stringify(createManifest(["alpha", "beta"], 10))
  });

  let output = "";

  await streamPackageNames("", {
    write(chunk: string) {
      output += chunk;
      return true;
    }
  });

  assert.equal(output, "alpha\nbeta\n");
});

test("base command streams names by prefix", async () => {
  mock({
    [defaultNamesPath]: JSON.stringify(["alpha", "beta", "betamax", "charlie"]),
    [defaultManifestPath]: JSON.stringify(createManifest(["alpha", "beta", "betamax", "charlie"], 10))
  });

  let output = "";

  await streamPackageNames("bet", {
    write(chunk: string) {
      output += chunk;
      return true;
    }
  });

  assert.equal(output, "beta\nbetamax\n");
});

test("has command prints true or false", async () => {
  mock({
    [defaultNamesPath]: JSON.stringify(["alpha", "beta"]),
    [defaultManifestPath]: JSON.stringify(createManifest(["alpha", "beta"], 10))
  });

  const hasBeta = await hasCommand("beta");
  const hasGamma = await hasCommand("gamma");

  assert.equal(hasBeta, "true");
  assert.equal(hasGamma, "false");
});

test("sync command prints a summary and updates the default store", async () => {
  mock({
    [defaultNamesPath]: JSON.stringify(["alpha"]),
    [defaultManifestPath]: JSON.stringify(createManifest(["alpha"], 10))
  });

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
      throw new Error(`Unexpected request: ${url}`);
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

  const result = await syncCommand();

  assert.match(result, /^Synced package names: since=11 count=2 added=1 removed=0 processedChanges=1$/);
  assert.deepEqual(await readNamesFile(defaultNamesPath), ["alpha", "beta"]);
  assert.deepEqual(await readManifest(defaultManifestPath), createManifest(["alpha", "beta"], 11));
});

test("bootstrap command restores the latest release package and prints a summary", async () => {
  mock({
    [packageJsonPath]: await packageJsonTextPromise,
    [defaultNamesPath]: JSON.stringify([]),
    [defaultManifestPath]: JSON.stringify(createManifest([], 0))
  });

  const version = "3.0.0-rc.1";
  const assetName = `all-package-names-${version}.tgz`;
  const assetUrl = `https://github.com/bconnorwhite/all-package-names/releases/download/v${version}/${assetName}`;
  const releaseAsset = await createReleasePackageBuffer(version, ["beta", "alpha"], 20);

  globalThis.fetch = ((input) => {
    const url = typeof input === "string" || input instanceof URL
      ? input.toString()
      : input.url;

    if(url === latestReleaseUrl) {
      return Promise.resolve({
        status: 200,
        json: () => Promise.resolve([{
          tag_name: `v${version}`,
          assets: [{
            name: assetName,
            browser_download_url: assetUrl
          }]
        }])
      } as Response);
    }

    if(url === assetUrl) {
      return Promise.resolve({
        status: 200,
        arrayBuffer: () => Promise.resolve(releaseAsset.buffer.slice(
          releaseAsset.byteOffset,
          releaseAsset.byteOffset + releaseAsset.byteLength
        ))
      } as Response);
    }

    throw new Error(`Unexpected request: ${url}`);
  }) as typeof fetch;

  const result = await bootstrapCommand({
    release: "latest"
  });

  assert.match(result, /^Bootstrapped package names from 3\.0\.0-rc\.1: since=20 count=2$/);
  assert.deepEqual(await readNamesFile(defaultNamesPath), ["alpha", "beta"]);
  assert.deepEqual(await readManifest(defaultManifestPath), createManifest(["alpha", "beta"], 20));
});

test("help output includes the prefix option and commands", async () => {
  const result = await cli.parse(["--help"], {
    silent: true
  });

  assert.equal(typeof result.message, "string");
  assert.match(result.message ?? "", /Usage: all-package-names \[options\] \[command\]/);
  assert.match(result.message ?? "", /-p, --prefix \[prefix\]/);
  assert.match(result.message ?? "", /has <name>/);
  assert.match(result.message ?? "", /sync/);
  assert.match(result.message ?? "", /bootstrap/);
});
