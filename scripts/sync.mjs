import { defaultNamesPath, readNamesFile } from "../build/backend/store.js";
import { syncNames } from "../build/sync/index.js";

const start = Date.now();
const beforeNames = await readNamesFile(defaultNamesPath);
const result = await syncNames();
const elapsedSeconds = Number(((Date.now() - start) / 1000).toFixed(2));

console.info(`New packages: ${String(result.count - beforeNames.length)}`);
console.info(`Total: ${String(result.count)}`);
console.info(`Time: ${String(elapsedSeconds)}s`);
