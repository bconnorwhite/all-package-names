/* eslint-disable import/no-relative-parent-imports, @typescript-eslint/no-floating-promises */
import assert from "node:assert/strict";
import { mkdtemp, open, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, test } from "node:test";
import { PagedReader } from "../src/backend/paged-reader.ts";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map(async (path) => rm(path, {
    force: true,
    recursive: true
  })));
});

test("paged reader supports empty reads, cross-page reads, byte reads, and eviction", async () => {
  const directory = await mkdtemp(join(tmpdir(), "all-package-names-"));
  tempDirs.push(directory);

  const path = join(directory, "names.json");
  await writeFile(path, "abcdefghijklmnopqrstuvwxyz");

  const handle = await open(path, "r");

  try {
    const reader = new PagedReader(handle, {
      pageSize: 5,
      maxCachedPages: 1
    });

    assert.equal((await reader.read(0, 0)).length, 0);
    assert.equal((await reader.read(3, 8)).toString("utf8"), "defghijk");
    assert.equal(await reader.readByte(-1), undefined);
    assert.equal(await reader.readByte(6), "g".charCodeAt(0));

    assert.equal((await reader.read(0, 2)).toString("utf8"), "ab");
    assert.equal((await reader.read(10, 2)).toString("utf8"), "kl");
    assert.equal((await reader.read(0, 2)).toString("utf8"), "ab");
  } finally {
    await handle.close();
  }
});
