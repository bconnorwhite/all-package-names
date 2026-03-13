/**
 * Configuration for selecting custom on-disk store locations.
 */
export type PackageNameDBOptions = {
  namesPath?: string;
  manifestPath?: string;
};

/**
 * Summary returned after syncing the local dataset from the replication feed.
 */
export type RefreshResult = {
  since: number;
  count: number;
  added: number;
  removed: number;
  processedChanges: number;
};

/**
 * Public interface for querying and refreshing the package-name dataset.
 */
export interface PackageNameDB extends AsyncIterable<string> {
  has(name: string): Promise<boolean>;
  toArray(): Promise<string[]>;
  iterPrefix(prefix: string): AsyncIterable<string>;
  refresh(): Promise<RefreshResult>;
}
