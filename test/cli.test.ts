import { test, expect, jest } from "@jest/globals";
import { exec } from "child_process";
import { syncAction } from "../source";

test("cli", (done) => {
  exec("node ./build/bin/index.js sync", (error, stdout, stderr) => {
    expect(error).toBe(null);
    expect(typeof stdout).toBe("string");
    expect(typeof stderr).toBe("string");
    done?.();
  });
}, 30000);

test("sync action", (done) => {
  let counter = 0;
  const prefixes = ["New packages: ", "Total: ", "Time: "];
  const spy = jest.spyOn(global.console, "info").mockImplementation((text: string) => {
    expect(text.substring(0, prefixes[counter].length)).toBe(prefixes[counter]);
    if(counter < prefixes.length - 1) {
      counter += 1;
    } else {
      spy.mockRestore();
      done?.();
    }
  });
  syncAction();
}, 30000);
