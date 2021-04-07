import { request } from "https";
import { getLock } from "p-lock";
import ProgressBar from "progress";
import { parseJSONObject, JSONObject } from "parse-json-object";
import { createCommand } from "commander-version";
import { load, save, isFresh, Save, LoadOptions } from "./load";

type Summary = {
  update_seq: number;
};

export type State = {
  /**
   * Starting package sync index
   */
  start: number;
  /**
   * Current package sync index
   */
  index: number;
  /**
   * Ending package sync index
   */
  end: number;
  /**
   * Percentage of sync completed
   */
  progress: number;
  /**
   * Milliseconds since sync began
   */
  elapsed: number;
  /**
   * Set of package names that have been added
   */
  packageNames: Set<string>;
};

type InternalState = {
  data: string;
} & State;

type Change = {
  seq: number;
  id: string;
};

export type StateHook = (state: State) => void;

export type SyncOptions = {
  onStart?: StateHook;
  onData?: StateHook;
  onEnd?: StateHook;
} & LoadOptions;

const getOptions = (path = "") => ({
  hostname: "replicate.npmjs.com",
  port: 443,
  path,
  method: "GET"
});

function getEnd() {
  return new Promise((resolve: (value: number) => void) => {
    let data = "";
    const options = getOptions();
    request(options, (res) => {
      res.on("data", (chunk) => {
        data += chunk.toString();
      });
      res.on("end", () => {
        const { update_seq } = parseJSONObject(data) as Summary;
        resolve(update_seq);
      });
    }).end();
  });
}

const initialState = ({ since, packageNames }: Save, end: number): InternalState => ({
  data: "",
  start: since,
  index: since,
  end,
  progress: 0,
  elapsed: 0,
  packageNames: new Set(packageNames)
});

function isChange(item?: JSONObject): item is Change {
  return item !== undefined && typeof item.seq === "number" && typeof item.id === "string";
}

function pump(state: InternalState) {
  while(state.data.indexOf("\n") !== state.data.lastIndexOf("\n")) {
    const newline = state.data.indexOf("\n", 1);
    let line = state.data.slice(0, newline);
    if(line.endsWith(",")) {
      line = line.slice(0, line.length-1);
    }
    const item = parseJSONObject(line);
    if(isChange(item)) {
      state.index = item.seq;
      state.packageNames.add(item.id);
      state.progress = (state.index - state.start) / (state.end - state.start);
    }
    state.data = state.data.slice(newline);
  }
}

const lock = getLock();

export function sync({ onData, onStart, onEnd, maxAge }: SyncOptions = {}) {
  const startTime = new Date().getTime();
  return new Promise((resolve: (data: Save) => void) => {
    lock().then((release) => {
      load({ maxAge }).then((data) => {
        if(isFresh(data, maxAge)) {
          release();
          resolve(data);
        } else {
          getEnd().then((end) => {
            const state = initialState(data, end);
            if(onStart) {
              onStart(state);
            }
            request(getOptions(`/_changes?since=${data.since}`), (res) => {
              res.on("data", (chunk) => {
                state.data += chunk.toString();
                pump(state);
                state.elapsed = new Date().getTime() - startTime;
                if(onData) {
                  onData(state);
                }
              });
              res.on("end", () => {
                if(onEnd) {
                  onEnd(state);
                }
                const newSave: Save = {
                  since: state.index,
                  timestamp: new Date().getTime(),
                  packageNames: Array.from(state.packageNames.values())
                };
                save(newSave).then(() => {
                  release();
                  resolve(newSave);
                });
              });
            }).end();
          });
        }
      });
    });
  });
}

export function syncAction(options?: LoadOptions) {
  let bar: ProgressBar;
  sync({
    onStart: (state) => {
      bar = new ProgressBar("syncing [:bar] :percent ", { total: state.end - state.start });
    },
    onData: (state) => {
      bar.update(state.progress);
    },
    onEnd: (state) => {
      console.info(`New packages: ${state.end - state.start}`);
      console.info(`Total: ${Object.keys(state.packageNames).length}`);
      console.info(`Time: ${state.elapsed / 1000}s`);
    },
    maxAge: options?.maxAge
  });
}

export default createCommand("sync")
  .description("Sync latest packages from NPM")
  .option("-m --max-age [milliseconds]", "Maximum milliseconds after a sync to avoid re-syncing", parseInt)
  .action(syncAction);
