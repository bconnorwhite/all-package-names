import { join } from "path";
import { load } from "./load";
import syncCommand, { sync, syncAction } from "./sync";

export const savePath = join(__dirname, "../data/all.json");

export {
  load,
  sync,
  syncCommand,
  syncAction
}
