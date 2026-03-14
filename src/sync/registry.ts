import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { x as extractTar } from "tar";

// Maximum limit allowed by the API is 10k.
const changesPageLimit = 10000;
const packageRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const packageJsonPath = resolve(packageRoot, "package.json");

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

export type HttpResponse<T> = {
  statusCode: number;
  body: T;
};

type ReplicationSummary = {
  update_seq: number | string;
};

type ChangesResponse = {
  last_seq: number | string;
  results: {
    id: string;
    seq: number | string;
    deleted?: boolean;
  }[];
};

type AllDocsResponse = {
  total_rows?: number;
  rows: {
    id: string;
  }[];
};

type ManifestResponse = {
  since?: number;
  count?: number;
  namesSha256?: string;
};

type GitHubReleaseResponse = {
  tag_name?: string;
  assets?: {
    name?: string;
    browser_download_url?: string;
  }[];
};

export type ChangesProgress = {
  phase: "changes";
  startSince: number;
  currentSince: number;
  targetSince: number;
  processedChanges: number;
};

export type AllDocsProgress = {
  phase: "all_docs";
  processedRows: number;
  syncedNames: number;
  totalRows?: number;
};

export type SyncProgress = ChangesProgress | AllDocsProgress;

type ProgressOptions<T extends SyncProgress> = {
  onProgress?: (progress: T) => void;
};

async function getJson<T extends JsonValue>(url: string): Promise<HttpResponse<T>> {
  const response = await fetch(url, {
    headers: {
      accept: "application/json"
    }
  });
  return {
    statusCode: response.status,
    body: await response.json() as T
  };
}

async function getBuffer(url: string): Promise<HttpResponse<Buffer>> {
  const response = await fetch(url, {
    headers: {
      accept: "application/octet-stream"
    }
  });
  return {
    statusCode: response.status,
    body: Buffer.from(await response.arrayBuffer())
  };
}

async function getGitHubJson<T extends JsonValue>(url: string): Promise<HttpResponse<T>> {
  const token = process.env["GITHUB_TOKEN"];
  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      ...(token === undefined ? {} : {
        authorization: `Bearer ${token}`
      })
    }
  });
  return {
    statusCode: response.status,
    body: await response.json() as T
  };
}

async function getGitHubBuffer(url: string): Promise<HttpResponse<Buffer>> {
  const token = process.env["GITHUB_TOKEN"];
  const response = await fetch(url, {
    headers: {
      accept: "application/octet-stream",
      ...(token === undefined ? {} : {
        authorization: `Bearer ${token}`
      })
    }
  });
  return {
    statusCode: response.status,
    body: Buffer.from(await response.arrayBuffer())
  };
}

async function getPackageMetadata() {
  const value = JSON.parse(await fs.readFile(packageJsonPath, "utf8")) as {
    name?: unknown;
    version?: unknown;
  };

  if(typeof value.name !== "string" || value.name.length === 0 || typeof value.version !== "string" || value.version.length === 0) {
    throw new Error("Could not resolve package metadata for release assets");
  }

  return {
    name: value.name,
    version: value.version
  };
}

function getReleasePackageName(name: string, version: string) {
  const safeName = name.startsWith("@")
    ? name.slice(1).replace(/\//g, "-")
    : name;
  return `${safeName}-${version}.tgz`;
}

function getSha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

async function readReleasePackage(buffer: Buffer, expectedVersion: string) {
  const directory = await fs.mkdtemp(join(tmpdir(), "all-package-names-"));
  const archivePath = resolve(directory, "release.tgz");
  const extractPath = resolve(directory, "extract");

  try {
    await fs.mkdir(extractPath, { recursive: true });
    await fs.writeFile(archivePath, buffer);
    await extractTar({
      cwd: extractPath,
      file: archivePath,
      strict: true
    });

    const [packageJson, namesText, manifestJson] = await Promise.all([
      fs.readFile(resolve(extractPath, "package", "package.json"), "utf8"),
      fs.readFile(resolve(extractPath, "package", "data", "names.json"), "utf8"),
      fs.readFile(resolve(extractPath, "package", "data", "manifest.json"), "utf8")
    ]);
    const packageValue = JSON.parse(packageJson) as {
      version?: unknown;
    };
    const namesValue = JSON.parse(namesText) as unknown;
    const manifestValue = JSON.parse(manifestJson) as ManifestResponse;

    if(typeof packageValue.version !== "string" || packageValue.version !== expectedVersion) {
      throw new Error("Release package version was invalid");
    }

    if(!Array.isArray(namesValue) || !namesValue.every((name) => typeof name === "string")) {
      throw new Error("Release names.json was invalid");
    }

    if(
      typeof manifestValue.since !== "number"
      || !Number.isFinite(manifestValue.since)
      || typeof manifestValue.count !== "number"
      || !Number.isFinite(manifestValue.count)
      || typeof manifestValue.namesSha256 !== "string"
    ) {
      throw new Error("Release manifest.json was invalid");
    }

    if(manifestValue.count !== namesValue.length || manifestValue.namesSha256 !== getSha256(namesText)) {
      throw new Error("Release package data did not match manifest.json");
    }

    return {
      names: new Set(namesValue),
      since: manifestValue.since
    };
  } finally {
    await fs.rm(directory, {
      force: true,
      recursive: true
    });
  }
}

export async function fetchReplicationHead() {
  const response = await getJson<ReplicationSummary>("https://replicate.npmjs.com/");

  if(response.statusCode >= 400) {
    throw new Error(`Could not fetch replication head (${String(response.statusCode)})`);
  }

  return typeof response.body.update_seq === "number"
    ? response.body.update_seq
    : Number(response.body.update_seq);
}

async function fetchChangesPage(since: number) {
  const response = await getJson<ChangesResponse>(
    `https://replicate.npmjs.com/registry/_changes?since=${String(since)}&limit=${String(changesPageLimit)}`
  );

  if(response.statusCode >= 400) {
    throw new Error(`Could not fetch replication changes (${String(response.statusCode)})`);
  }

  if(!Array.isArray(response.body.results)) {
    throw new Error("Replication feed response did not include results");
  }

  return {
    results: response.body.results,
    since: typeof response.body.last_seq === "number"
      ? response.body.last_seq
      : Number(response.body.last_seq)
  };
}

/**
 * Accumulates replication changes from the provided sequence onward.
 */
export async function fetchChangesSince(
  since: number,
  options: ProgressOptions<ChangesProgress> = {}
) {
  const created = new Set<string>();
  const deleted = new Set<string>();
  const targetSince = await fetchReplicationHead();
  let cursor = since;
  let processedChanges = 0;

  options.onProgress?.({
    phase: "changes",
    startSince: since,
    currentSince: since,
    targetSince,
    processedChanges
  });

  while(true) {
    const page = await fetchChangesPage(cursor);
    processedChanges += page.results.length;

    options.onProgress?.({
      phase: "changes",
      startSince: since,
      currentSince: page.since,
      targetSince,
      processedChanges
    });

    for(const item of page.results) {
      if(!item.id.startsWith("_")) {
        if(item.deleted === true) {
          created.delete(item.id);
          deleted.add(item.id);
        } else {
          deleted.delete(item.id);
          created.add(item.id);
        }
      }
    }

    if(page.results.length === 0 || page.results.length < changesPageLimit || page.since <= cursor) {
      return {
        since: page.since,
        created,
        deleted,
        processedChanges
      };
    }

    cursor = page.since;
  }
}

/**
 * Bootstraps the full package-name set from the replication `_all_docs` endpoint.
 *
 * Relevant discussion of supported replication queries:
 * https://github.com/orgs/community/discussions/152515
 */
export async function seedNamesFromAllDocs(
  options: ProgressOptions<AllDocsProgress> = {}
) {
  const names = new Set<string>();
  let processedRows = 0;
  let totalRows: number | undefined;
  let startKey: string | undefined;

  while(true) {
    const query = startKey === undefined
      ? "limit=10000"
      : `limit=10000&startkey=${encodeURIComponent(JSON.stringify(startKey))}`;
    const response = await getJson<AllDocsResponse>(
      `https://replicate.npmjs.com/registry/_all_docs?${query}`
    );

    if(response.statusCode >= 400) {
      throw new Error(`Could not fetch _all_docs bootstrap (${String(response.statusCode)})`);
    }

    if(typeof response.body.total_rows === "number" && Number.isFinite(response.body.total_rows)) {
      totalRows = response.body.total_rows;
    }

    if(!Array.isArray(response.body.rows) || response.body.rows.length === 0) {
      break;
    }

    const pageRows = startKey !== undefined
      && response.body.rows[0]?.id === startKey
      ? response.body.rows.length - 1
      : response.body.rows.length;

    processedRows += Math.max(pageRows, 0);

    let addedThisPage = 0;
    for(const row of response.body.rows) {
      if(row.id !== startKey && !row.id.startsWith("_")) {
        const before = names.size;
        names.add(row.id);
        if(names.size > before) {
          addedThisPage += 1;
        }
      }
    }

    if(pageRows > 0) {
      options.onProgress?.({
        phase: "all_docs",
        processedRows,
        syncedNames: names.size,
        totalRows
      });
    }

    if(addedThisPage === 0) {
      break;
    }

    const lastRow = response.body.rows.at(-1);
    if(lastRow === undefined) {
      break;
    }

    startKey = lastRow.id;
  }

  return {
    names,
    since: await fetchReplicationHead()
  };
}

/**
 * Seeds the local dataset from the current package version's GitHub release assets,
 * falling back to `_all_docs` if those assets are unavailable or invalid.
 */
export async function seedNamesFromReleaseAssets(
  options: ProgressOptions<AllDocsProgress> = {}
) {
  try {
    const { name, version } = await getPackageMetadata();
    const assetName = getReleasePackageName(name, version);
    const response = await getBuffer(
      `https://github.com/bconnorwhite/all-package-names/releases/download/v${version}/${assetName}`
    );

    if(response.statusCode >= 400) {
      return await seedNamesFromAllDocs(options);
    }

    return await readReleasePackage(response.body, version);
  } catch{
    return await seedNamesFromAllDocs(options);
  }
}

/**
 * Downloads and validates the latest published GitHub release package.
 */
export async function fetchLatestReleasePackage() {
  const owner = process.env["GITHUB_OWNER"] ?? "bconnorwhite";
  const repo = process.env["GITHUB_REPO"] ?? "all-package-names";
  const { name } = await getPackageMetadata();
  const releaseResponse = await getGitHubJson<GitHubReleaseResponse[]>(
    `https://api.github.com/repos/${owner}/${repo}/releases?per_page=1`
  );

  if(releaseResponse.statusCode >= 400) {
    throw new Error(`Could not fetch GitHub releases (${String(releaseResponse.statusCode)})`);
  }

  if(!Array.isArray(releaseResponse.body) || releaseResponse.body.length === 0) {
    throw new Error("No GitHub releases were available to bootstrap");
  }

  const release = releaseResponse.body[0];
  if(release === undefined) {
    throw new Error("No GitHub releases were available to bootstrap");
  }
  const tagName = typeof release?.tag_name === "string" ? release.tag_name : undefined;

  if(tagName === undefined || !tagName.startsWith("v")) {
    throw new Error("Latest GitHub release did not have a valid tag");
  }

  const version = tagName.slice(1);
  const assetName = getReleasePackageName(name, version);
  const asset = release.assets?.find((value) => value?.name === assetName);

  if(typeof asset?.browser_download_url !== "string" || asset.browser_download_url.length === 0) {
    throw new Error(`Latest GitHub release did not include ${assetName}`);
  }

  const assetResponse = await getGitHubBuffer(asset.browser_download_url);

  if(assetResponse.statusCode >= 400) {
    throw new Error(`Could not download ${assetName} (${String(assetResponse.statusCode)})`);
  }

  const seeded = await readReleasePackage(assetResponse.body, version);
  return {
    ...seeded,
    version
  };
}
