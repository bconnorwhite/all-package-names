#!/usr/bin/env node
import { pathToFileURL } from "node:url";
import clee, { parseString } from "clee";
import ora from "ora";
import allPackageNames from "../index.ts";
import { bootstrapNames, syncNames } from "../sync/index.ts";
import type { SyncProgress } from "../sync/registry.ts";

const numberFormat = new Intl.NumberFormat("en-US");

function formatSyncResult(result: Awaited<ReturnType<typeof syncNames>>) {
  return `Synced package names: since=${String(result.since)} count=${String(result.count)} added=${String(result.added)} removed=${String(result.removed)} processedChanges=${String(result.processedChanges)}`;
}

function formatBootstrapResult(result: Awaited<ReturnType<typeof bootstrapNames>>) {
  return `Bootstrapped package names from ${result.version}: since=${String(result.since)} count=${String(result.count)}`;
}

function formatNumber(value: number) {
  return numberFormat.format(value);
}

function formatSyncProgress(progress: SyncProgress) {
  if(progress.phase === "all_docs") {
    const total = progress.totalRows === undefined
      ? "?"
      : formatNumber(progress.totalRows);

    return `Bootstrapping from _all_docs: ${formatNumber(progress.processedRows)} / ${total} rows (${formatNumber(progress.syncedNames)} package names)`;
  }

  return `Applying changes: since ${formatNumber(progress.currentSince)} / ${formatNumber(progress.targetSince)} (${formatNumber(progress.processedChanges)} changes processed)`;
}

export const hasCommand = clee("has")
  .cwd()
  .description("Check whether a package name exists")
  .argument("<name>", "The package name to check")
  .action(async (name) => {
    return String(await allPackageNames.has(name));
  });

export const syncCommand = clee("sync")
  .cwd()
  .description("Sync the local dataset from the npm replication feed")
  .action(async () => {
    const spinner = process.stderr.isTTY
      ? ora({
        stream: process.stderr,
        text: "Syncing package names..."
      }).start()
      : undefined;

    try {
      const result = await syncNames({
        onProgress(progress) {
          if(spinner !== undefined) {
            spinner.text = formatSyncProgress(progress);
          }
        }
      });

      spinner?.stop();
      return formatSyncResult(result);
    } catch(error) {
      spinner?.stop();
      throw error;
    }
  });

export const bootstrapCommand = clee("bootstrap")
  .cwd()
  .description("Restore the local dataset from the latest GitHub release")
  .action(async () => {
    return formatBootstrapResult(await bootstrapNames());
  });

export async function streamPackageNames(
  prefix: string,
  writer: Pick<NodeJS.WritableStream, "write"> = process.stdout
) {
  for await (const name of allPackageNames.iterPrefix(prefix)) {
    writer.write(`${name}\n`);
  }
}

const cli = clee("all-package-names")
  .cwd()
  .description("Stream, query, and maintain the all-package-names dataset")
  .option("-p", "--prefix", "[prefix]", "Only output package names with this prefix", parseString)
  .command(hasCommand)
  .command(syncCommand)
  .command(bootstrapCommand)
  .version(import.meta.url)
  .action(async (options) => {
    await streamPackageNames(options.prefix ?? "");
  });

export default cli;

if(process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await cli.parse();
}
