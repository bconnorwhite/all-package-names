<!--BEGIN HEADER-->
<div id="top" align="center">
  <h1>all-package-names</h1>
  <a href="https://npmjs.com/package/all-package-names">
    <img alt="NPM" src="https://img.shields.io/npm/v/all-package-names.svg">
  </a>
  <a href="https://github.com/bconnorwhite/all-package-names">
    <img alt="TypeScript" src="https://img.shields.io/github/languages/top/bconnorwhite/all-package-names.svg">
  </a>
  <a href="https://coveralls.io/github/bconnorwhite/all-package-names?branch=main">
    <img alt="Coverage Status" src="https://img.shields.io/coveralls/github/bconnorwhite/all-package-names.svg?branch=main">
  </a>
</div>

<br />

<blockquote align="center">Fast lookup and iteration over all NPM package names</blockquote>

---
<!--END HEADER-->

Includes a list of all package names on NPM. Updated daily, with optional local synchronization.

Packages which are deleted from NPM are removed from this list.

<!-- BEGIN INSTALLATION -->
## Installation

<details open>
  <summary>
    <a href="https://www.npmjs.com/package/all-package-names">
      <img src="https://img.shields.io/badge/npm-CB3837?logo=npm&logoColor=white" alt="NPM" />
    </a>
  </summary>

```sh
npm install all-package-names
```

</details>

<details>
  <summary>
    <a href="https://yarnpkg.com/package/all-package-names">
      <img src="https://img.shields.io/badge/yarn-2C8EBB?logo=yarn&logoColor=white" alt="Yarn" />
    </a>
  </summary>

```sh
yarn add all-package-names
```

</details>

<details>
  <summary>
    <img src="https://img.shields.io/badge/pnpm-F69220?logo=pnpm&logoColor=white" alt="PNPM" />
  </summary>

```sh
pnpm add all-package-names
```

</details>

<details>
  <summary>
    <img src="https://img.shields.io/badge/bun-EE81C3?logo=bun&logoColor=white" alt="Bun" />
  </summary>

```sh
bun add all-package-names
```

</details>
<!-- END INSTALLATION -->

## Usage

> Uses binary search on the underlying dataset to quickly check for existence or iterate over packages with a given prefix without having to load the entire list into memory. However, the full list can also be loaded as a string array.

## API

Check if a package exists without loading the full array:

```ts
import allPackageNames from "all-package-names";

console.log(await allPackageNames.has("react")); // true
```

Iterate packages by prefix:

```ts
import allPackageNames from "all-package-names";

for await (const name of allPackageNames.iterPrefix("@types/")) {
  console.log(name);
}
```

Load all names into memory as a string array:

```ts
import allPackageNames from "all-package-names";

const names = await allPackageNames.toArray();
```

Refresh the local files from the npm replication feed:

```ts
import allPackageNames from "all-package-names";

const result = await allPackageNames.refresh();

console.log(result);
```

## CLI

```
Stream, query, and maintain the all-package-names dataset

Usage: all-package-names [options] [command]

Options:
  -p, --prefix [prefix]  Only output package names with this prefix
  -v, --version          Display version
  -h, --help             Display help for command

Commands:
  has <name>             Check whether a package name exists
  sync                   Sync the local dataset from the npm replication feed
  bootstrap              Restore the local dataset from the latest GitHub release
```

Stream every package name, one per line:

```sh
all-package-names
```

Only stream names with a given prefix:

```sh
all-package-names --prefix @types/
```

This is useful for piping to other programs, for example:

```sh
all-package-names --prefix @types/ | grep react
```

**has**

Check whether a package exists with the `has` subcommand:

```sh
all-package-names has react
```

<!--BEGIN FOOTER-->
<h2 id="license">License <a href="https://opensource.org/licenses/MIT"><img align="right" alt="license" src="https://img.shields.io/npm/l/all-package-names.svg"></a></h2>

[MIT](https://opensource.org/licenses/MIT) - _MIT License_
<!--END FOOTER-->


## Related Packages
- [package-name-conflict](https://npmjs.com/package/package-name-conflict): Check if NPM package names conflict
- [is-name-taken](https://npmjs.com/package/is-name-taken): Check if an NPM package name is taken
- [npms-io-client](https://npmjs.com/package/npms-io-client): Isomorphic typed client for npms.io
- [npm-pd](https://npmjs.com/package/npms-pd): A CLI dashboard for NPM publishers
