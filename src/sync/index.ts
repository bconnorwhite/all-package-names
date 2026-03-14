/* eslint-disable import/no-relative-parent-imports */
import { getLock } from "p-lock";
import {
  createManifest,
  defaultManifestPath,
  defaultNamesPath,
  ensureStoreFiles,
  readManifest,
  readNamesFile,
  writeManifest,
  writeNamesFile
} from "../backend/store.ts";
import { fetchChangesSince, fetchLatestReleasePackage, seedNamesFromReleaseAssets } from "./registry.ts";

const syncLock = getLock();

/**
 * Options for syncing a custom package-name store.
 */
export type SyncOptions = {
  namesPath?: string;
  manifestPath?: string;
};

/**
 * Summary returned after applying replication changes to the local store.
 */
export type SyncResult = {
  since: number;
  count: number;
  added: number;
  removed: number;
  processedChanges: number;
};

/**
 * Options for restoring a custom package-name store from the latest release.
 */
export type BootstrapOptions = {
  namesPath?: string;
  manifestPath?: string;
};

/**
 * Summary returned after restoring the local store from the latest release.
 */
export type BootstrapResult = {
  version: string;
  since: number;
  count: number;
};

function uniqueSortedNames(names: Iterable<string>) {
  const values = Array.from(names).filter((name) => name.length > 0);
  values.sort();
  return values.filter((name, index) => index === 0 || name !== values[index - 1]);
}

/**
 * Restores the local store from the latest published GitHub release.
 */
export async function bootstrapNames(options: BootstrapOptions = {}): Promise<BootstrapResult> {
  const namesPath = options.namesPath ?? defaultNamesPath;
  const manifestPath = options.manifestPath ?? defaultManifestPath;
  const seeded = await fetchLatestReleasePackage();
  const names = uniqueSortedNames(seeded.names);
  const manifest = createManifest(names, seeded.since);

  await Promise.all([
    writeNamesFile(namesPath, names),
    writeManifest(manifestPath, manifest)
  ]);

  return {
    version: seeded.version,
    since: seeded.since,
    count: names.length
  };
}

/**
 * Synchronizes the local store files with the npm replication feed.
 */
export async function syncNames(options: SyncOptions = {}): Promise<SyncResult> {
  const namesPath = options.namesPath ?? defaultNamesPath;
  const manifestPath = options.manifestPath ?? defaultManifestPath;

  return syncLock().then(async (release) => {
    try {
      await ensureStoreFiles(namesPath, manifestPath);

      let names = await readNamesFile(namesPath);
      let manifest = await readManifest(manifestPath);

      if(names.length === 0) {
        const seeded = await seedNamesFromReleaseAssets();
        names = uniqueSortedNames(seeded.names);
        manifest = createManifest(names, seeded.since);
      }

      const changes = await fetchChangesSince(manifest.since);
      const set = new Set(names);

      for(const name of changes.deleted) {
        set.delete(name);
      }

      for(const name of changes.created) {
        set.add(name);
      }

      const nextNames = uniqueSortedNames(set);
      const nextManifest = createManifest(nextNames, changes.since);

      await Promise.all([
        writeNamesFile(namesPath, nextNames),
        writeManifest(manifestPath, nextManifest)
      ]);

      return {
        since: changes.since,
        count: nextNames.length,
        added: changes.created.size,
        removed: changes.deleted.size,
        processedChanges: changes.processedChanges
      };
    } finally {
      release();
    }
  });
}
