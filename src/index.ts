import { AllPackageNames } from "./backend/index.ts";

const allPackageNames = new AllPackageNames();

export default allPackageNames;

export type { PackageNameDB, PackageNameDBOptions, RefreshResult } from "./backend/types.ts";
