import { test, expect } from "@jest/globals";
import { sync, load } from "../source";
import { State } from "../source/sync";

test("sync", (done) => {
  sync().then((save) => {
    expect(typeof save.since).toBe("number");
    expect(typeof save.timestamp).toBe("number");
    expect(Array.isArray(save.packageNames)).toBe(true);
    done?.();
  });
}, 30000);

test("sync max age", (done) => {
  sync().then((save1) => {
    sync({ maxAge: 30000 }).then((save2) => {
      expect(save1.since).toBe(save2.since);
      expect(save1.timestamp).toBe(save2.timestamp);
      expect(save1.packageNames.length).toBe(save2.packageNames.length);
      done?.();
    });
  });
}, 30000);

test("sync sequential", (done) => {
  sync();
  sync().then((save) => {
    expect(typeof save.since).toBe("number");
    expect(typeof save.timestamp).toBe("number");
    expect(Array.isArray(save.packageNames)).toBe(true);
    done?.();
  });
}, 30000);

test("sync max age parallel", (done) => {
  setTimeout(() => {
    Promise.all([
      sync({ maxAge: 9000 }),
      sync({ maxAge: 9000 })
    ]).then(([save1, save2]) => {
      expect(save1.since).toEqual(save2.since);
      expect(save1.timestamp).toEqual(save2.timestamp);
      expect(save1.packageNames.length).toEqual(save2.packageNames.length);
      done?.();
    });
  }, 10000);
}, 30000);

test("sync with hooks", (done) => {
  sync({
    onStart: (state: State) => {
      expect(typeof state).toBe("object");
    },
    onEnd: (state: State) => {
      expect(typeof state).toBe("object");
    },
    onData: (state) => {
      expect(typeof state).toBe("object");
    }
  }).then((save) => {
    expect(typeof save.since).toBe("number");
    expect(typeof save.timestamp).toBe("number");
    expect(Array.isArray(save.packageNames)).toBe(true);
    done?.();
  });
}, 30000);

test("load", (done) => {
  load().then((save) => {
    expect(typeof save.since).toBe("number");
    expect(typeof save.timestamp).toBe("number");
    expect(Array.isArray(save.packageNames)).toBe(true);
    done?.();
  });
});

test("load max age", (done) => {
  load().then((save1) => {
    load({ maxAge: 30000 }).then((save2) => {
      expect(save1.since).toBe(save2.since);
      expect(save1.timestamp).toBe(save2.timestamp);
      expect(save1.packageNames.length).toBe(save2.packageNames.length);
      done?.();
    });
  });
});
