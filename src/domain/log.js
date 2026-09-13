// Single append-only event stream. Portal history is a filtered view of it.

export function makeEntry(state, portal, action, result, message, scoreDelta = 0) {
  return {
    tick: state.tick,
    portalId: portal ? portal.id : null,
    portalName: portal ? portal.name : null,
    action,
    result,
    message,
    scoreDelta,
  };
}

export function appendLog(state, entry) {
  const withId = { ...entry, id: `e${state.log.length + 1}` };
  return { ...state, log: [...state.log, withId] };
}

export function appendEntries(state, entries) {
  return entries.reduce((acc, entry) => appendLog(acc, entry), state);
}

export function portalHistory(state, portalId) {
  return state.log.filter((e) => e.portalId === portalId);
}
