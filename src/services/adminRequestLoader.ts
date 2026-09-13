export interface AdminRequestLoaderCallbacks<T> {
  onInitialLoading: () => void;
  onRefreshing: () => void;
  onSuccess: (data: T) => void;
  onFailure: (error: unknown, isInitialLoad: boolean) => void;
}

export interface AdminRequestLoader {
  load: () => Promise<void>;
}

/**
 * Coordinates request reads without allowing overlapping refreshes. The
 * caller owns mounted checks and presentation state; this helper only tracks
 * whether a successful read has happened and whether one is already running.
 */
export const createAdminRequestLoader = <T>(
  read: () => Promise<T>,
  callbacks: AdminRequestLoaderCallbacks<T>
): AdminRequestLoader => {
  let hasCompletedInitialLoad = false;
  let inFlight: Promise<void> | null = null;

  return {
    load: () => {
      if (inFlight) return inFlight;

      const isInitialLoad = !hasCompletedInitialLoad;
      if (isInitialLoad) callbacks.onInitialLoading();
      else callbacks.onRefreshing();

      const run = async () => {
        try {
          const data = await read();
          hasCompletedInitialLoad = true;
          callbacks.onSuccess(data);
        } catch (error) {
          callbacks.onFailure(error, isInitialLoad);
        }
      };

      const promise = run().finally(() => {
        if (inFlight === promise) inFlight = null;
      });
      inFlight = promise;
      return promise;
    },
  };
};
