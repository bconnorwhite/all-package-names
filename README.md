<div align="center">
  <h1>all-package-names</h1>
  <a href="https://npmjs.com/package/all-package-names">
    <img alt="npm" src="https://img.shields.io/npm/v/all-package-names.svg">
  </a>
  <a href="https://github.com/bconnorwhite/all-package-names">
    <img alt="typescript" src="https://img.shields.io/github/languages/top/bconnorwhite/all-package-names.svg">
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
```
#### Types:
```ts
load(): Promise<Save>

sync({ onData, onStart, onEnd }: SyncOptions = {}) => Promise<Save>;

type Save = {
  since: number; // last index synced
  packageNames: string[];
}

type SyncOptions = {
  onStart?: (state: State) => void;
  onData?: (state: State) => void;
  onEnd?: (state: State) => void;
}

type State = {
  start: number;    // start index
  index: number;    // current index
  end: number;      // end index
  progress: number; // percent of sync completed
  elapsed: number;  // milliseconds since sync began
  packageNames: PackageNames;
};

type PackageNames = {
  [name: string]: true;
}
```

##

<br />

### CLI Usage:
#### yarn all-package-names --help
```
Usage: index [options] [command]

Options:
  -V, --version   output the version number
  -h, --help      display help for command

Commands:
  sync            sync packages with latest from NPM
  help [command]  display help for command
```

##

<br />

### Sync:
#### yarn all-package-names sync --help
Sync latest packages from NPM.
```
Usage: index sync [options]

Sync latest packages from NPM

Options:
  -h, --help  display help for command
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

- [commander](https://npmjs.com/package/commander): The complete solution for node.js command-line programs
- [parse-json-object](https://www.npmjs.com/package/parse-json-object): Parse a typed JSON object.
- [progress](https://www.npmjs.com/package/progress): Flexible ascii progress bar
- [read-json-safe](https://www.npmjs.com/package/read-json-safe): Read objects from JSON files without try catch.
- [write-json-safe](https://www.npmjs.com/package/write-json-safe): Write formatted JSON to a file, and create parent directories if necessary.

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
