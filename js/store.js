const Store = (() => {
  const state = {
    snapshot: null,
    isLoading: false,
    lastError: null,
    activeTab: "race",
    standingsMode: "drivers",
  };

  const listeners = [];
  function subscribe(fn) {
    listeners.push(fn);
  }
  function notify() {
    listeners.forEach((fn) => fn(state));
  }

  function getSetting(key, fallback) {
    const v = localStorage.getItem(key);
    return v === null ? fallback : v;
  }
  function setSetting(key, value) {
    if (value === null || value === undefined) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, value);
    }
    notify();
  }

  async function refresh() {
    state.isLoading = true;
    notify();
    try {
      const snapshot = await F1Api.fetchSnapshot();
      state.snapshot = snapshot;
      state.lastError = null;
      localStorage.setItem("f1_snapshot_cache", JSON.stringify(snapshot));
    } catch (err) {
      state.lastError = err.message || "Failed to load data";
      if (!state.snapshot) {
        const cached = localStorage.getItem("f1_snapshot_cache");
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            state.snapshot = reviveSnapshot(parsed);
          } catch (_) {}
        }
      }
    }
    state.isLoading = false;
    notify();
  }

  function reviveSnapshot(raw) {
    return {
      ...raw,
      races: raw.races.map((r) => ({
        ...r,
        sessions: r.sessions.map((s) => ({ ...s, date: new Date(s.date) })),
      })),
    };
  }

  function init() {
    const cached = localStorage.getItem("f1_snapshot_cache");
    if (cached) {
      try {
        state.snapshot = reviveSnapshot(JSON.parse(cached));
      } catch (_) {}
    }
  }

  function setTab(tab) {
    state.activeTab = tab;
    notify();
  }

  function setStandingsMode(mode) {
    state.standingsMode = mode;
    notify();
  }

  return {
    state,
    subscribe,
    refresh,
    init,
    setTab,
    setStandingsMode,
    getSetting,
    setSetting,
  };
})();
