#!/usr/bin/env node
import { performance } from "node:perf_hooks";
import { Bench } from "tinybench";
import allPackageNames from "../build/index.js";
import { defaultMetadataPath, readMetadata } from "../build/backend/store.js";

async function runBench(name, fn, options = {}) {
  const bench = new Bench({
    iterations: 1,
    time: 1,
    warmup: false,
    warmupIterations: 0,
    warmupTime: 0,
    ...options
  });

  bench.add(name, fn);
  await bench.run();

  const task = bench.tasks[0];
  if(task?.result === undefined) {
    throw new Error(`Missing benchmark result for ${name}`);
  }

  return Number(task.result.latency.mean.toFixed(2));
}

async function benchmark() {
  const hasMs = await runBench("hasMs", async () => {
    await allPackageNames.has("react");
  }, {
    iterations: 100,
    time: 100
  });

  const iterateMs = await runBench("iterateMs", async () => {
    for await (const name of allPackageNames) {
      void name;
    }
  });

  const prefixIterMs = await runBench("prefixIterMs", async () => {
    for await (const name of allPackageNames.iterPrefix("@types/")) {
      void name;
    }
  });

  const toArrayMs = await runBench("toArrayMs", async () => {
    let arr = await allPackageNames.toArray();
    console.log(arr.length);
  });

  const { since } = await readMetadata(defaultMetadataPath);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (input) => {
    const url = typeof input === "string" || input instanceof URL
      ? input.toString()
      : input.url;

    if(url !== `https://replicate.npmjs.com/registry/_changes?since=${String(since)}&limit=10000`) {
      throw new Error(`Unexpected benchmark fetch: ${url}`);
    }

    return Promise.resolve({
      status: 200,
      json: () => Promise.resolve({
        results: [],
        last_seq: since
      })
    });
  };

  const rebuildStart = performance.now();
  try {
    await allPackageNames.refresh();
  } finally {
    globalThis.fetch = originalFetch;
  }
  const rebuildMs = Number((performance.now() - rebuildStart).toFixed(2));

  console.table([{
    hasMs,
    iterateMs,
    prefixIterMs,
    toArrayMs,
    rebuildMs
  }]);
}

benchmark().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(() => {
  process.exit(process.exitCode ?? 0);
});
