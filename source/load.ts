import { readJSON, JSONValue } from "read-json-safe";
import { isJSONObject } from "types-json";
import { savePath } from "./";

export type Save = {
  since: number;
  timestamp: number;
  packageNames: string[];
}

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

export async function load(): Promise<Save> {
  return readJSON(savePath).then((data) => {
    if(isJSONObject(data)) {
      return {
        since: isPositiveNumber(data.since) ? data.since : saveTemplate.since,
        timestamp: isPositiveNumber(data.timestamp) ? data.timestamp : saveTemplate.timestamp,
        packageNames: Array.isArray(data.packageNames) ? filterStringArray(data.packageNames) : saveTemplate.packageNames
      };
    } else {
      return saveTemplate;
    }
  });
}
