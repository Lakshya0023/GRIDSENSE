/**
 * Tracks whether the UI is showing real backend data or the bundled mock
 * scenarios.
 *
 * The API client used to swallow every fetch failure and silently substitute
 * `buildHealthyScenario()` / `buildStressScenario()`, logging only a
 * `console.warn`.  That made a dead backend indistinguishable from a working
 * one during a demo.  Every fallback now reports itself here so the UI can say
 * so out loud.
 */

export type DataSourceState = {
  /** True once any request has fallen back to bundled mock data. */
  degraded: boolean;
  /** API paths that failed, in first-seen order. */
  endpoints: string[];
  /** Message from the most recent failure, for the banner's detail line. */
  lastReason: string | null;
  /** Epoch ms of the most recent fallback. */
  since: number | null;
};

const state: DataSourceState = {
  degraded: false,
  endpoints: [],
  lastReason: null,
  since: null,
};

type Listener = () => void;
const listeners = new Set<Listener>();

// Cached immutable snapshot. useSyncExternalStore compares snapshots by
// identity, so this must stay the same reference until something actually
// changes — returning a fresh object each read would loop forever.
let cached: DataSourceState = { ...state, endpoints: [] };

function emit() {
  cached = { ...state, endpoints: [...state.endpoints] };
  listeners.forEach((listener) => listener());
}

/** Stable snapshot for useSyncExternalStore. */
export function getDataSourceSnapshot(): DataSourceState {
  return cached;
}

/** The server render never has a degraded state to report. */
export function getDataSourceServerSnapshot(): DataSourceState {
  return SERVER_SNAPSHOT;
}

const SERVER_SNAPSHOT: DataSourceState = {
  degraded: false,
  endpoints: [],
  lastReason: null,
  since: null,
};

/** Called by the API client whenever it serves mock data instead of backend data. */
export function reportMockFallback(endpoint: string, reason: unknown) {
  const message = reason instanceof Error ? reason.message : String(reason);
  const isNew = !state.endpoints.includes(endpoint);

  if (isNew) state.endpoints.push(endpoint);
  state.lastReason = message;
  if (!state.degraded) state.since = Date.now();
  state.degraded = true;

  // Keep the console breadcrumb — it is useful when debugging — but the banner
  // is now the primary signal.
  console.warn(`[GridSense] ${endpoint} unreachable, serving mock data:`, reason);

  emit();
}

/** Called when a request succeeds, so the banner can clear itself. */
export function reportLiveData(endpoint: string) {
  if (!state.degraded) return;

  const index = state.endpoints.indexOf(endpoint);
  if (index !== -1) state.endpoints.splice(index, 1);

  if (state.endpoints.length === 0) {
    state.degraded = false;
    state.lastReason = null;
    state.since = null;
  }

  emit();
}

export function subscribeToDataSource(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
