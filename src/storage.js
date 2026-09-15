const SAVE_KEY = 'portal-lab:save:v1';

export function saveState(state) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  } catch {
    /* storage unavailable — ignore */
  }
}

// Returns { state, corrupt }. A missing save is not an error (corrupt: false);
// a save that exists but cannot be parsed/shaped is (corrupt: true).
export function loadState() {
  let raw;
  try {
    raw = localStorage.getItem(SAVE_KEY);
  } catch {
    return { state: null, corrupt: false };
  }
  if (!raw) return { state: null, corrupt: false };
  try {
    const state = JSON.parse(raw);
    if (!state || state.version !== 1 || !Array.isArray(state.portals)) {
      return { state: null, corrupt: true };
    }
    return { state, corrupt: false };
  } catch {
    return { state: null, corrupt: true };
  }
}

export function clearState() {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    /* ignore */
  }
}
