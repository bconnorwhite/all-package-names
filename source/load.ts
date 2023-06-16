import { createReadStream, createWriteStream } from "node:fs";
import { createGunzip, createGzip } from "node:zlib";
import { promisify } from "node:util";
import { pipeline, Readable } from "node:stream";
import { JSONValue, isJSONObject } from "types-json";
import { savePath } from "./";

export type Save = {
  /**
   * Index of last package synced
   */
  since: number;
  /**
   * Timestamp of last sync
   */
  timestamp: number;
  /**
   * Array of package names
   */
  packageNames: string[];
};

export type LoadOptions = {
  /**
   * Maximum milliseconds after a sync to avoid re-syncing
   */
   maxAge?: number;
};

function isPositiveNumber(value?: JSONValue): value is number {
  return typeof value === "number" && value >= 0;
}

function filterStringArray(array: JSONValue[]) {
  return array.filter((value) => typeof value === "string") as string[];
}

const saveTemplate: Save = {
  since: 0,
  timestamp: 0,
  packageNames: []
};

let cache: Save | undefined;

function readJsonGz(filename: string): Promise<JSONValue | undefined> {
  return new Promise((resolve, reject) => {
    const gunzip = createGunzip();
    const readStream = createReadStream(filename);
    readStream.on('error', (err) => {
      resolve(undefined);
    });
    gunzip.on('error', (err) => {
      resolve(undefined);
    });
    let json = "";
    readStream.pipe(gunzip);
    gunzip.on("data", chunk => {
      json += chunk.toString();
    });
    gunzip.on("end", () => {
      try {
        resolve(JSON.parse(json));
      } catch (err) {
        resolve(undefined);
      }
    });
  });
}

async function writeJsonGz(filename: string, save: Save) {
  const readable = Readable.from([JSON.stringify(save)]);
  const gzip = createGzip();
  const writeStream = createWriteStream(filename);
  const pipe = promisify(pipeline);
  await pipe(readable, gzip, writeStream);
}

export async function save(data: Save) {
  cache = data;
  return writeJsonGz(savePath, data);
}

export function isFresh({ timestamp }: Save, maxAge = 0) {
  return timestamp + maxAge > new Date().getTime();
}

export async function load(options?: LoadOptions): Promise<Save> {
  if(cache !== undefined && isFresh(cache, options?.maxAge)) {
    return Promise.resolve(cache);
  } else {
    const data = await readJsonGz(savePath);
    if(isJSONObject(data)) {
      cache = {
        since: isPositiveNumber(data.since) ? data.since : saveTemplate.since,
        timestamp: isPositiveNumber(data.timestamp) ? data.timestamp : saveTemplate.timestamp,
        packageNames: Array.isArray(data.packageNames) ? filterStringArray(data.packageNames) : saveTemplate.packageNames
      };
    } else {
      cache = saveTemplate;
    }
    return cache;
  }
}
