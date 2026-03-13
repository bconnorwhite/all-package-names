#!/usr/bin/env node
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { x as extractTar } from "tar";

// Where to bootstrap from
const owner = process.env.GITHUB_OWNER ?? "bconnorwhite";
const repo = process.env.GITHUB_REPO ?? "all-package-names";
const token = process.env.GITHUB_TOKEN;

// Where to save the data
const packageJsonPath = resolve(process.cwd(), "package.json");
const dataDir = resolve(process.cwd(), "data");
const namesPath = resolve(dataDir, "names.json");
const manifestPath = resolve(dataDir, "manifest.json");

function getHeaders(accept) {
  return {
    accept,
    ...(token === undefined ? {} : {
      authorization: `Bearer ${token}`
    })
  };
}

function getReleasePackageName(name, version) {
  const safeName = name.startsWith("@")
    ? name.slice(1).replace(/\//g, "-")
    : name;
  return `${safeName}-${version}.tgz`;
}

function getSha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

async function fetchJson(url, description) {
  const response = await fetch(url, {
    headers: getHeaders("application/json")
  });

  if(!response.ok) {
    throw new Error(`${description} (${String(response.status)})`);
  }

  return response.json();
}

async function fetchBuffer(url, description) {
  const response = await fetch(url, {
    headers: getHeaders("application/octet-stream")
  });

  if(!response.ok) {
    throw new Error(`${description} (${String(response.status)})`);
  }

  return Buffer.from(await response.arrayBuffer());
}

async function getPackageName() {
  const value = JSON.parse(await readFile(packageJsonPath, "utf8"));

  if(typeof value.name !== "string" || value.name.length === 0) {
    throw new Error("Could not resolve package name");
  }

  return value.name;
}

async function restoreReleasePackage(buffer, expectedVersion) {
  const directory = await mkdtemp(join(tmpdir(), "all-package-names-"));
  const archivePath = resolve(directory, "release.tgz");
  const extractPath = resolve(directory, "extract");

  try {
    await mkdir(extractPath, { recursive: true });
    await writeFile(archivePath, buffer);
    await extractTar({
      cwd: extractPath,
      file: archivePath,
      strict: true
    });

    const [packageJson, namesJson, manifestJson] = await Promise.all([
      readFile(resolve(extractPath, "package", "package.json"), "utf8"),
      readFile(resolve(extractPath, "package", "data", "names.json"), "utf8"),
      readFile(resolve(extractPath, "package", "data", "manifest.json"), "utf8")
    ]);
    const packageValue = JSON.parse(packageJson);
    const namesValue = JSON.parse(namesJson);
    const manifestValue = JSON.parse(manifestJson);

    if(typeof packageValue.version !== "string" || packageValue.version !== expectedVersion) {
      throw new Error("Downloaded package version was invalid");
    }

    if(!Array.isArray(namesValue) || !namesValue.every((name) => typeof name === "string")) {
      throw new Error("Downloaded names.json was invalid");
    }

    if(
      typeof manifestValue.since !== "number"
      || !Number.isFinite(manifestValue.since)
      || typeof manifestValue.count !== "number"
      || !Number.isFinite(manifestValue.count)
      || typeof manifestValue.namesSha256 !== "string"
    ) {
      throw new Error("Downloaded manifest.json was invalid");
    }

    if(manifestValue.count !== namesValue.length || manifestValue.namesSha256 !== getSha256(namesJson)) {
      throw new Error("Downloaded package data did not match manifest.json");
    }

    await mkdir(dataDir, { recursive: true });
    await Promise.all([
      writeFile(namesPath, namesJson),
      writeFile(manifestPath, manifestJson)
    ]);
  } finally {
    await rm(directory, {
      force: true,
      recursive: true
    });
  }
}

const packageName = await getPackageName();
const releases = await fetchJson(
  `https://api.github.com/repos/${owner}/${repo}/releases?per_page=1`,
  "Could not fetch GitHub releases"
);

if(!Array.isArray(releases) || releases.length === 0) {
  throw new Error("No GitHub releases were available to bootstrap");
}

const release = releases[0];
const tagName = typeof release?.tag_name === "string" ? release.tag_name : undefined;

if(tagName === undefined || !tagName.startsWith("v")) {
  throw new Error("Latest GitHub release did not have a valid tag");
}

const version = tagName.slice(1);
const expectedAssetName = getReleasePackageName(packageName, version);
const asset = release.assets?.find((value) => value?.name === expectedAssetName);

if(typeof asset?.browser_download_url !== "string" || asset.browser_download_url.length === 0) {
  throw new Error(`Latest GitHub release did not include ${expectedAssetName}`);
}

const assetBuffer = await fetchBuffer(asset.browser_download_url, `Could not download ${expectedAssetName}`);
await restoreReleasePackage(assetBuffer, version);
console.info(`Bootstrapped release package ${expectedAssetName}`);
