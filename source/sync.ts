import { request } from "https";
import { parseJSONObject, JSONObject } from "parse-json-object";
import { writeJSON } from "write-json-safe";
import ProgressBar from "progress";
import { createCommand } from "commander-version";
import { load, Save } from "./load";
import { savePath } from "./";

type Summary = {
  update_seq: number;
}

type PackageNames = {
  [name: string]: true;
}

type State = {
  start: number; // start index
  index: number; // current index
  end: number; // end index
  progress: number; // percent of sync completed
  elapsed: number; // milliseconds since sync started
  packageNames: PackageNames;
};

type InternalState = {
  data: string;
} & State;

type Change = {
  seq: number;
  id: string;
}

type SyncActionOptions = {
  /**
   * Timeout in milliseconds after a sync to avoid re-syncing
   */
   timeout?: number;
}

type SyncOptions = {
  onStart?: (state: State) => void;
  onData?: (state: State) => void;
  onEnd?: (state: State) => void;
} & SyncActionOptions;

const getOptions = (path: string = "") => ({
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

const initialState = (save: Save, end: number): InternalState => ({
  data: "",
  start: save.since,
  index: save.since,
  end,
  progress: 0,
  elapsed: 0,
  packageNames: save.packageNames.reduce((retval, name) => {
    retval[name] = true;
    return retval;
  }, {} as PackageNames)
});

function isChange(item?: JSONObject): item is Change {
  return item !== undefined && typeof item.seq === "number" && typeof item.id === "string";
}

function pump(state: InternalState) {
  while(state.data.indexOf("\n") !== state.data.lastIndexOf("\n")) {
    const newline = state.data.indexOf("\n", 1);
    let line = state.data.slice(0,newline);
    if(line.endsWith(",")) {
      line = line.slice(0,line.length-1);
    }
    const item = parseJSONObject(line);
    if(isChange(item)) {
      state.index = item.seq;
      state.packageNames[item.id] = true;
      state.progress = (state.index - state.start) / (state.end - state.start);
    }
    state.data = state.data.slice(newline);
  }
}

export function sync({ onData, onStart, onEnd, timeout }: SyncOptions = {}) {
  const startTime = new Date().getTime();
  return new Promise((resolve: (save: Save) => void) => {
    load().then((save) => {
      if(timeout !== undefined && save.timestamp + timeout > startTime) {
        resolve(save);
      } else {
        getEnd().then((end) => {
          const state = initialState(save, end);
          if(onStart) {
            onStart(state);
          }
          request(getOptions(`/_changes?since=${save.since}`), (res) => {
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
                packageNames: Object.keys(state.packageNames)
              };
              writeJSON(savePath, newSave, { pretty: false }).then(() => {
                resolve(newSave);
              });
            });
          }).end();
        });
      }
    });
  });
}

export function syncAction({ timeout }: SyncActionOptions) {
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
      console.info(`Total: ${Object.keys(state.packageNames).length}`)
      console.info(`Time: ${state.elapsed / 1000}s`);
    },
    timeout
  });
}

export default createCommand("sync")
  .description("Sync latest packages from NPM")
  .option("-t --timeout [delay]", "timeout in milliseconds after a sync to avoid re-syncing", parseInt)
  .action(syncAction)
