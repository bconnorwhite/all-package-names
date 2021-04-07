import { readJSON, JSONValue } from "read-json-safe";
import { writeJSON } from "write-json-safe";
import { isJSONObject } from "types-json";
import { savePath } from "./";

export type Save = {
  since: number;
  timestamp: number;
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

export async function save(data: Save) {
  cache = data;
  return writeJSON(savePath, data, { pretty: false });
}

export function isFresh({ timestamp }: Save, maxAge = 0) {
  return timestamp + maxAge > new Date().getTime();
}

export async function load(options?: LoadOptions): Promise<Save> {
  if(cache !== undefined && isFresh(cache, options?.maxAge)) {
    return Promise.resolve(cache);
  } else {
    return readJSON(savePath).then((data) => {
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
    });
  }
}
