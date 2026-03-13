/* eslint-disable import/no-relative-parent-imports */
import { createReadStream, promises as fs } from "node:fs";
import { defaultManifestPath, defaultNamesPath, ensureStoreFiles, readNamesFile } from "./store.ts";
import { PagedReader } from "./paged-reader.ts";
import type { PackageNameDB, PackageNameDBOptions } from "./types.ts";
import { syncNames } from "../sync/index.ts";

const QUOTE = "\"".charCodeAt(0);
const COMMA = ",".charCodeAt(0);
const ARRAY_START = "[".charCodeAt(0);
const SEARCH_CHUNK_SIZE = 4096;

type LocatedName = {
  start: number;
  value: string;
  nextStart: number;
};

/**
 * File-backed package-name database.
 *
 * Lookup and iteration operate directly on `names.json`; only `toArray()`
 * parses the full file into memory.
 */
export class AllPackageNames implements PackageNameDB {
  private readonly namesPath: string;
  private readonly manifestPath: string;
  public constructor(options: PackageNameDBOptions = {}) {
    this.namesPath = options.namesPath ?? defaultNamesPath;
    this.manifestPath = options.manifestPath ?? defaultManifestPath;
  }
  /**
   * Returns true if the package name exists in the database.
   *
   * Runs a binary search to quickly find the package name without loading the full file into memory.
   */
  public async has(name: string) {
    return this.withFile(async (reader, fileSize) => {
      const item = await lowerBound(reader, fileSize, name);
      return item?.value === name;
    });
  }
  public async toArray() {
    return readNamesFile(this.namesPath);
  }
  public async *[Symbol.asyncIterator](): AsyncIterableIterator<string> {
    yield* this.iterPrefix("");
  }
  public async *iterPrefix(prefix: string): AsyncIterable<string> {
    const start = await this.withFile(async (reader, fileSize) => {
      return prefix.length === 0
        ? findFirstItemStart(reader, fileSize)
        : (await lowerBound(reader, fileSize, prefix))?.start;
    });

    if(start === undefined) {
      return;
    }

    yield* iterateNamesFrom(this.namesPath, start, prefix);
  }
  public async refresh() {
    return syncNames({
      namesPath: this.namesPath,
      manifestPath: this.manifestPath
    });
  }
  private async withFile<T>(run: (reader: PagedReader, fileSize: number) => Promise<T>) {
    await ensureStoreFiles(this.namesPath, this.manifestPath);
    const handle = await fs.open(this.namesPath, "r");

    try {
      const { size } = await handle.stat();
      return await run(new PagedReader(handle), size);
    } finally {
      await handle.close();
    }
  }
}

/**
 * Finds the first item whose value is greater than or equal to `target`
 * using byte-position binary search over the compact JSON array.
 */
async function lowerBound(reader: PagedReader, fileSize: number, target: string) {
  const firstStart = await findFirstItemStart(reader, fileSize);
  if(firstStart === undefined) {
    return undefined;
  }

  let low = firstStart;
  let high = fileSize;

  while(low < high) {
    const middle = Math.floor((low + high) / 2);
    const start = await findItemStartAtOrBefore(reader, fileSize, middle);

    if(start === undefined || start < low) {
      return await readItemAt(reader, fileSize, low);
    }

    const item = await readItemAt(reader, fileSize, start);

    if(item === undefined) {
      high = start;
    } else if(item.value >= target) {
      high = start;
    } else {
      low = item.nextStart;
    }
  }

  return low < fileSize ? readItemAt(reader, fileSize, low) : undefined;
}

/*
 * Returns the byte offset of the first string entry in the compact JSON array.
 * Returns undefined if the array is empty or malformed.
 */
async function findFirstItemStart(reader: PagedReader, fileSize: number) {
  if(fileSize < 2) {
    return undefined;
  }
  const firstByte = await reader.readByte(0);
  const secondByte = await reader.readByte(1);
  if(firstByte !== ARRAY_START || secondByte !== QUOTE) {
    return undefined;
  }
  return 1;
}

/**
 * Walks backward from an arbitrary byte offset to the start of the containing
 * or previous item boundary.
 */
async function findItemStartAtOrBefore(reader: PagedReader, fileSize: number, offset: number) {
  let position = Math.min(Math.max(offset, 0), fileSize - 1);

  while(position >= 0) {
    const chunkStart = Math.max(0, position - SEARCH_CHUNK_SIZE + 1);
    const chunk = await reader.read(chunkStart, position - chunkStart + 1);

    for(let index = chunk.length - 1; index >= 0; index -= 1) {
      const value = chunk[index];

      if(value === ARRAY_START || value === COMMA) {
        const start = chunkStart + index + 1;
        const nextByte = await reader.readByte(start);
        return nextByte === QUOTE ? start : undefined;
      }
    }

    if(chunkStart === 0) {
      return undefined;
    }

    position = chunkStart - 1;
  }

  return undefined;
}

/**
 * Reads a single package-name entry starting at its opening quote byte.
 */
async function readItemAt(reader: PagedReader, fileSize: number, start: number): Promise<LocatedName | undefined> {
  if(await reader.readByte(start) !== QUOTE) {
    return undefined;
  }

  const end = await findClosingQuote(reader, fileSize, start + 1);
  if(end === undefined) {
    return undefined;
  }

  const buffer = await reader.read(start + 1, end - start - 1);
  const separator = await reader.readByte(end + 1);
  const nextStart = separator === COMMA ? end + 2 : fileSize;

  return {
    start,
    value: buffer.toString("utf8"),
    nextStart
  };
}

/**
 * Scans forward to the next closing quote.
 */
async function findClosingQuote(reader: PagedReader, fileSize: number, offset: number) {
  let position = offset;

  while(position < fileSize) {
    const chunk = await reader.read(position, Math.min(SEARCH_CHUNK_SIZE, fileSize - position));
    const quoteIndex = chunk.indexOf(QUOTE);

    if(quoteIndex !== -1) {
      return position + quoteIndex;
    }

    position += chunk.length;
  }

  return undefined;
}

/**
 * Streams package names sequentially from a known item-start offset.
 */
async function *iterateNamesFrom(path: string, start: number, prefix: string): AsyncIterableIterator<string> {
  const stream = createReadStream(path, {
    encoding: "utf8",
    start
  });
  const chunks = stream as AsyncIterable<string>;

  let inString = false;
  let pending = "";

  try {
    for await (const chunk of chunks) {
      let index = 0;

      while(index < chunk.length) {
        if(inString) {
          const quoteIndex = chunk.indexOf("\"", index);

          if(quoteIndex === -1) {
            pending += chunk.slice(index);
            break;
          }

          const value = pending + chunk.slice(index, quoteIndex);
          pending = "";

          if(prefix.length > 0 && !value.startsWith(prefix)) {
            return;
          }

          yield value;
          inString = false;
          index = quoteIndex + 1;
        } else {
          const quoteIndex = chunk.indexOf("\"", index);

          if(quoteIndex === -1) {
            if(chunk.indexOf("]", index) !== -1) {
              return;
            }
            break;
          }

          inString = true;
          index = quoteIndex + 1;
        }
      }
    }
  } finally {
    stream.destroy();
  }
}
