import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { fileExists } from "file-exists-safe";
import { readJSONObject } from "read-json-safe";

const packageRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const dataDir = resolve(packageRoot, "data");

export type Manifest = {
  since: number;
  count: number;
  namesSha256: string;
};

export const defaultNamesPath = resolve(dataDir, "names.json");
export const defaultManifestPath = resolve(dataDir, "manifest.json");

function getStoreFileHash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function getNamesFileContents(names: readonly string[]) {
  return JSON.stringify(names);
}

export function createManifest(names: readonly string[], since: number): Manifest {
  const contents = getNamesFileContents(names);
  return {
    since,
    count: names.length,
    namesSha256: getStoreFileHash(contents)
  };
}

const emptyManifest = createManifest([], 0);

async function writeStoreFile(path: string, value: string) {
  await fs.mkdir(dirname(path), { recursive: true });
  await fs.writeFile(path, value);
}

export async function readNamesFile(path: string): Promise<string[]> {
  try {
    const value = JSON.parse(await fs.readFile(path, "utf8")) as unknown;
    return Array.isArray(value)
      ? value.filter((name): name is string => typeof name === "string")
      : [];
  } catch{
    return [];
  }
}

export async function writeNamesFile(path: string, names: readonly string[]) {
  await writeStoreFile(path, getNamesFileContents(names));
}

export async function readManifest(path: string): Promise<Manifest> {
  const value = await readJSONObject(path);
  const since = value?.["since"];
  const count = value?.["count"];
  const namesSha256 = value?.["namesSha256"];
  return {
    since: typeof since === "number" && Number.isFinite(since) ? since : 0,
    count: typeof count === "number" && Number.isFinite(count) ? count : 0,
    namesSha256: typeof namesSha256 === "string" ? namesSha256 : emptyManifest.namesSha256
  };
}

export async function writeManifest(path: string, manifest: Manifest) {
  await writeStoreFile(path, JSON.stringify(manifest, null, 2));
}

export async function ensureStoreFiles(namesPath = defaultNamesPath, manifestPath = defaultManifestPath) {
  const [hasNames, hasManifest] = await Promise.all([
    fileExists(namesPath),
    fileExists(manifestPath)
  ]);

  if(hasNames !== true) {
    await writeNamesFile(namesPath, []);
  }

  if(hasManifest !== true) {
    await writeManifest(manifestPath, hasNames === true
      ? createManifest(await readNamesFile(namesPath), 0)
      : emptyManifest);
  }
}
