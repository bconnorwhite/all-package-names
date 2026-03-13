#!/usr/bin/env node
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { x as extractTar } from "tar";

const owner = process.env.GITHUB_OWNER ?? "bconnorwhite";
const repo = process.env.GITHUB_REPO ?? "all-package-names";
const token = process.env.GITHUB_TOKEN;
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

async function fetchBuffer(url, description) {
  const response = await fetch(url, {
    headers: getHeaders("application/octet-stream")
  });

  if(!response.ok) {
    throw new Error(`${description} (${String(response.status)})`);
  }

  return Buffer.from(await response.arrayBuffer());
}

async function getPackageMetadata() {
  const value = JSON.parse(await readFile(packageJsonPath, "utf8"));

  if(typeof value.name !== "string" || value.name.length === 0 || typeof value.version !== "string" || value.version.length === 0) {
    throw new Error("Could not resolve package metadata");
  }

  return value;
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

const { name, version } = await getPackageMetadata();
const assetName = getReleasePackageName(name, version);
const assetBuffer = await fetchBuffer(
  `https://github.com/${owner}/${repo}/releases/download/v${version}/${assetName}`,
  `Could not download ${assetName}`
);

await restoreReleasePackage(assetBuffer, version);
console.info(`Downloaded release package ${assetName}`);
