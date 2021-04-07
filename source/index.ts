import { join } from "path";
import { load, LoadOptions, Save } from "./load";
import syncCommand, { sync, syncAction, SyncOptions, State, StateHook } from "./sync";

export const savePath = join(__dirname, "../data/all.json");

export {
  load,
  sync,
  syncCommand,
  syncAction,
  LoadOptions,
  SyncOptions,
  Save,
  State,
  StateHook
};
