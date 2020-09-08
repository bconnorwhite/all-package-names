import { readJSONFile, JSONObject } from "read-json-safe";
import { savePath } from "./";

export type Save = {
  since: number;
  packageNames: string[];
}

function isSave(data?: JSONObject): data is Save {
  return data !== undefined && typeof data.since === "number" && Array.isArray(data.packageNames);
}

export async function load() {
  return readJSONFile(savePath).then((data) => {
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
