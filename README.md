<div align="center">
  <h1>all-package-names</h1>
  <a href="https://npmjs.com/package/all-package-names">
    <img alt="npm" src="https://img.shields.io/npm/v/all-package-names.svg">
  </a>
  <a href="https://github.com/bconnorwhite/all-package-names">
    <img alt="typescript" src="https://img.shields.io/github/languages/top/bconnorwhite/all-package-names.svg">
  </a>
  <a href='https://coveralls.io/github/bconnorwhite/all-package-names?branch=master'>
    <img alt="Coverage Status" src="https://img.shields.io/coveralls/github/bconnorwhite/all-package-names.svg?branch=master">
  </a>
  <a href="https://github.com/bconnorwhite/all-package-names">
    <img alt="GitHub stars" src="https://img.shields.io/github/stars/bconnorwhite/all-package-names?label=Stars%20Appreciated%21&style=social">
  </a>
  <a href="https://twitter.com/bconnorwhite">
    <img alt="Twitter Follow" src="https://img.shields.io/twitter/follow/bconnorwhite.svg?label=%40bconnorwhite&style=social">
  </a>
</div>

<br />

> Get all NPM package names.

Includes a JSON file of all NPM package names at the time of last publish, but also allows for syncing with latest packages.

## Installation

```bash
yarn add all-package-names
```

```bash
npm install all-package-names
```
## API
- [Programmatic Usage](#Programmatic-Usage)
- [CLI Usage](#CLI-Usage)
  - [all-package-names sync](#Sync)
- [Commander Plugins](#Commander-Plugins)

##

<br />

### Programmatic Usage:

```ts
import { load, sync } from "all-package-names";

// Load from an existing sync (included on install)

load().then(({ packageNames }) => {
  console.log(packageNames); // array of all package names on npm
});

// Sync and return new package names

sync().then(({ packageNames }) => {
 console.log(packageNames); // array of all package names on npm
});

// Load with a maxAge of 1 minute

load({ maxAge: 60000 }).then(({ packageNames }) => {
  console.log(packageNames); // array of all package names on npm
});

// Sync with a maxAge of 1 minute

sync({ maxAge: 60000 }).then(({ packageNames }) => {
 console.log(packageNames); // array of all package names on npm
});
```
#### Basic Types:
```ts
import { load, sync, LoadOptions, SyncOptions, Save, State, StateHook } from "all-package-names";

function load({ maxAge }: LoadOptions): Promise<Save>

function sync({ maxAge }: LoadOptions = {}) => Promise<Save>;

type LoadOptions = {
  /**
   * Maximum milliseconds after a sync to avoid re-syncing
   */
   maxAge?: number;
};

type Save = {
  /**
   * Index of last package synced
   */
  since: number;
  /**
   * Timestamp of last sync
   */
  timestamp: number;
  /**
   * Array of package names
   */
  packageNames: string[];
};

```
#### State Hooks:
```ts
import { sync, LoadOptions, SyncOptions, Save, State, StateHook } from "all-package-names";

function sync({ onData, onStart, onEnd, maxAge }: SyncOptions = {}) => Promise<Save>;

type SyncOptions = {
  onStart?: StateHook;
  onData?: StateHook;
  onEnd?: StateHook;
} & LoadOptions;

type StateHook = (state: State) => void;

type State = {
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
```

##

<br />

### CLI Usage:
#### yarn all-package-names --help
```
Usage: all-package-names [options] [command]

Options:
  -v --version    output the version number
  -h, --help      display help for command

Commands:
  sync [options]  Sync latest packages from NPM
  help [command]  display help for command
```

##

<br />

### Sync:
#### yarn all-package-names sync --help
Sync latest packages from NPM.
```
Usage: all-package-names sync [options]

Sync latest packages from NPM

Options:
  -m --max-age [milliseconds]  Maximum milliseconds after a sync to avoid re-syncing
  -h, --help                   display help for command
```

##

<br />

### Commander Plugins:
Add all-package-names commands to any commander program:
```ts
import { program } from "commander";
import { syncCommand } from "all-package-names";

syncCommand(program);
```

##

<br />


<h2>Dependencies<img align="right" alt="dependencies" src="https://img.shields.io/david/bconnorwhite/all-package-names.svg"></h2>

- [commander-version](https://npmjs.com/package/commander-version): A wrapper for Commander that automatically sets the version based on your package.json
- [parse-json-object](https://www.npmjs.com/package/parse-json-object): Parse a typed JSON object
- [progress](https://www.npmjs.com/package/progress): Flexible ascii progress bar
- [read-json-safe](https://www.npmjs.com/package/read-json-safe): Read JSON files without try catch
- [types-json](https://www.npmjs.com/package/types-json): Type checking for JSON objects
- [write-json-safe](https://www.npmjs.com/package/write-json-safe): Write formatted JSON to a file

##

<br />

<h2>Dev Dependencies<img align="right" alt="David" src="https://img.shields.io/david/dev/bconnorwhite/all-package-names.svg"></h2>

- [@bconnorwhite/bob](https://npmjs.com/package/@bconnorwhite/bob): Bob builds and watches typescript projects.
- [@types/node](https://npmjs.com/package/@types/node): TypeScript definitions for Node.js
- [@types/progress](https://npmjs.com/package/@types/progress): TypeScript definitions for node-progress

##

<br />

<h2>License <img align="right" alt="license" src="https://img.shields.io/npm/l/all-package-names.svg"></h2>

[MIT](https://mit-license.org/)

##

<br />

## Related Packages
- [npm-pd](https://npmjs.com/package/npms-pd): A CLI dashboard for NPM publishers
- [npms-io-client](https://npmjs.com/package/npms-io-client): Isomorphic typed client for npms.io
- [package-name-conflict](https://npmjs.com/package/package-name-conflict): Check if NPM package names conflict
- [is-name-taken](https://npmjs.com/package/is-name-taken): Check if an NPM package name is taken
