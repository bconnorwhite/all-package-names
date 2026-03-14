/* eslint-disable import/no-relative-parent-imports */
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { c as createTar } from "tar";
import { createManifest, getNamesFileContents, writeManifest, writeNamesFile } from "../src/backend/store.ts";

export async function writeFixture(namesPath: string, manifestPath: string, names: string[], since = 1) {
  const sorted = Array.from(new Set(names)).sort();
  await writeNamesFile(namesPath, sorted);
  await writeManifest(manifestPath, createManifest(sorted, since));
}

export async function createReleasePackageBuffer(
  version: string,
  names: readonly string[],
  since: number,
  options: {
    manifest?: {
      since?: unknown;
      count?: unknown;
      namesSha256?: unknown;
    };
    packageVersion?: unknown;
  } = {}
) {
  const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8")) as {
    name: string;
  };
  const directory = await mkdtemp(join(tmpdir(), "all-package-names-"));
  const packageDir = resolve(directory, "package");
  const archivePath = resolve(directory, "release.tgz");
  const namesJson = getNamesFileContents(names);
  const manifest = {
    ...createManifest(names, since),
    ...options.manifest
  };

  try {
    await mkdir(resolve(packageDir, "data"), { recursive: true });
    await writeFile(resolve(packageDir, "package.json"), JSON.stringify({
      name: packageJson.name,
      version: options.packageVersion ?? version
    }));
    await writeFile(resolve(packageDir, "data", "names.json"), namesJson);
    await writeFile(resolve(packageDir, "data", "manifest.json"), JSON.stringify(manifest));
    await createTar({
      cwd: directory,
      file: archivePath,
      gzip: true,
      portable: true
    }, ["package"]);
    return await readFile(archivePath);
  } finally {
    await rm(directory, {
      force: true,
      recursive: true
    });
  }
}
