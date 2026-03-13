/* eslint-disable import/no-relative-parent-imports, @typescript-eslint/no-floating-promises */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, test } from "node:test";
import { createManifest, readManifest, readNamesFile } from "../src/backend/store.ts";
import { syncNames } from "../src/sync/index.ts";
import { createReleasePackageBuffer } from "./helpers.ts";

const originalFetch = globalThis.fetch;
const tempDirs: string[] = [];
const releasePackagePromise = readFile(new URL("../package.json", import.meta.url), "utf8").then((value) => {
  const packageJson = JSON.parse(value) as {
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
});

afterEach(async () => {
  globalThis.fetch = originalFetch;
  await Promise.all(tempDirs.splice(0).map(async (path) => rm(path, {
    force: true,
    recursive: true
  })));
});

test("syncNames seeds from release assets when the local names file is empty", async () => {
  const directory = await mkdtemp(join(tmpdir(), "all-package-names-"));
  tempDirs.push(directory);

  const namesPath = join(directory, "names.json");
  const manifestPath = join(directory, "manifest.json");
  const { url: releaseAssetUrl, version } = await releasePackagePromise;
  const releaseAsset = await createReleasePackageBuffer(version, ["beta", "", "alpha", "alpha"], 20);

  globalThis.fetch = ((input) => {
    const url = typeof input === "string" || input instanceof URL
      ? input.toString()
      : input.url;

    if(url === releaseAssetUrl) {
      return Promise.resolve({
        status: 200,
        arrayBuffer: () => Promise.resolve(releaseAsset.buffer.slice(
          releaseAsset.byteOffset,
          releaseAsset.byteOffset + releaseAsset.byteLength
        ))
      } as Response);
    }

    if(url === "https://replicate.npmjs.com/registry/_changes?since=20&limit=10000") {
      return Promise.resolve({
        status: 200,
        json: () => Promise.resolve({
          results: [
            { id: "beta", seq: 21, deleted: true },
            { id: "gamma", seq: 22 }
          ],
          last_seq: 22
        })
      } as Response);
    }

    throw new Error(`Unexpected JSON request: ${url}`);
  }) as typeof fetch;

  const result = await syncNames({
    namesPath,
    manifestPath
  });

  assert.deepEqual(result, {
    since: 22,
    count: 2,
    added: 1,
    removed: 1,
    processedChanges: 2
  });
  assert.deepEqual(await readNamesFile(namesPath), ["alpha", "gamma"]);
  assert.deepEqual(await readManifest(manifestPath), createManifest(["alpha", "gamma"], 22));
});
