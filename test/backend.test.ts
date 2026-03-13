/* eslint-disable import/no-relative-parent-imports, @typescript-eslint/no-floating-promises */
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import { afterEach, beforeEach, test } from "node:test";
import mock, { restore } from "mock-fs";
import { AllPackageNames } from "../src/backend/index.ts";
import { createManifest, writeManifest } from "../src/backend/store.ts";
import { writeFixture } from "./helpers.ts";

const namesPath = "/virtual/data/names.json";
const manifestPath = "/virtual/data/manifest.json";

beforeEach(() => {
  mock({
    "/virtual/data": {}
  });
});

afterEach(() => {
  restore();
});

test("database streams long names and stops prefix iteration when the first match is past the prefix", async () => {
  const longName = `a${"x".repeat(70000)}`;
  await writeFixture(namesPath, manifestPath, [longName, "bbb", "ccc"], 1);

  const index = new AllPackageNames({
    namesPath,
    manifestPath
  });

  const iterated: string[] = [];
  for await (const name of index) {
    iterated.push(name);
  }

  const prefixed: string[] = [];
  for await (const name of index.iterPrefix("bbz")) {
    prefixed.push(name);
  }

  assert.deepEqual(iterated, [longName, "bbb", "ccc"]);
  assert.deepEqual(prefixed, []);
});

test("database treats malformed names files as empty or incomplete data", async () => {
  await writeManifest(manifestPath, createManifest([], 1));

  await fs.writeFile(namesPath, "[");
  let index = new AllPackageNames({
    namesPath,
    manifestPath
  });
  assert.equal(await index.has("alpha"), false);
  assert.deepEqual(await index.toArray(), []);

  await fs.writeFile(namesPath, "[\"alpha\",beta]");
  index = new AllPackageNames({
    namesPath,
    manifestPath
  });
  assert.equal(await index.has("zzz"), false);

  await fs.writeFile(namesPath, "[\"alpha");
  index = new AllPackageNames({
    namesPath,
    manifestPath
  });
  assert.equal(await index.has("alpha"), false);

  await fs.writeFile(namesPath, `["alpha",${"x".repeat(70000)}`);
  index = new AllPackageNames({
    namesPath,
    manifestPath
  });

  const iterated: string[] = [];
  for await (const name of index) {
    iterated.push(name);
  }

  assert.deepEqual(iterated, ["alpha"]);
});
