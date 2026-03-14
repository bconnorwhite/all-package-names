import { AllPackageNames } from "./backend/index.ts";

export { bootstrapNames, syncNames } from "./sync/index.ts";

const allPackageNames = new AllPackageNames();

export default allPackageNames;

export type { PackageNameDB, PackageNameDBOptions, RefreshResult } from "./backend/types.ts";
export type { BootstrapOptions, BootstrapResult, SyncOptions, SyncResult } from "./sync/index.ts";
export type { AllDocsProgress, ChangesProgress, SyncProgress } from "./sync/registry.ts";
