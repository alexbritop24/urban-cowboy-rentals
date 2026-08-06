export interface MultiItemFeatureFlags {
  readNormalizedItems: boolean;
  writeNormalizedItems: boolean;
}

// Disabled by default so this foundation cannot query tables that have not
// been introduced yet or alter the Release 1 user experience.
export const multiItemFeatureFlags: Readonly<MultiItemFeatureFlags> =
  Object.freeze({
    readNormalizedItems: false,
    writeNormalizedItems: false,
  });
