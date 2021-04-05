import { test, expect, beforeEach, afterEach } from "@jest/globals";
import mock, { restore } from "mock-fs";
import { load } from "../source";

beforeEach(async () => {
  mock({
    "./data": {}
  });
});

afterEach(async () => {
  restore();
});

test("load empty", (done) => {
  load().then((save) => {
    expect(save.since).toBe(0);
    expect(save.timestamp).toBe(0);
    expect(Array.isArray(save.packageNames)).toBe(true);
    done?.();
  });
});
