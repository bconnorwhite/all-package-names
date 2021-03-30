import { readJSON, JSONObject, JSONArray } from "read-json-safe";
import { isJSONObject } from "types-json";
import { savePath } from "./";

export type Save = {
  since: number;
  packageNames: string[];
}

function isSave(data?: string | number | boolean | JSONObject | JSONArray | null): data is Save {
  return isJSONObject(data) && typeof data.since === "number" && Array.isArray(data.packageNames);
}

export async function load() {
  return readJSON(savePath).then((data) => {
    if(isSave(data)) {
      return data;
    } else {
      return {
        since: 0,
        packageNames: []
      }
    }
  });
}
