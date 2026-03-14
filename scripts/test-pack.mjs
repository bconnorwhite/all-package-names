#!/usr/bin/env node
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const packageRoot = resolve(import.meta.dirname, "..");
const npmCache = process.env["npm_config_cache"];

function getEnv() {
  return npmCache === undefined
    ? process.env
    : {
      ...process.env,
      npm_config_cache: npmCache
    };
}

async function run(command, args, cwd) {
  return execFileAsync(command, args, {
    cwd,
    env: getEnv()
  });
}

const tempDirectory = await mkdtemp(join(tmpdir(), "all-package-names-pack-test-"));

try {
  const { stdout: packStdout } = await run("npm", ["pack"], packageRoot);
  const tarball = packStdout.trim().split("\n").at(-1);

  if(typeof tarball !== "string" || tarball.length === 0) {
    throw new Error("Could not resolve packed tarball name");
  }

  const tarballPath = resolve(packageRoot, tarball);
  await run("npm", ["init", "-y"], tempDirectory);
  await run("npm", ["install", tarballPath], tempDirectory);

  const binPath = resolve(tempDirectory, "node_modules", ".bin", "all-package-names");
  const help = await run(binPath, ["--help"], tempDirectory);
  assert.match(help.stdout, /Usage: all-package-names \[options\] \[command\]/);
} finally {
  await rm(tempDirectory, {
    force: true,
    recursive: true
  });
}
