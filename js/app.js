(function () {
  const content = document.getElementById("content");
  const tabButtons = document.querySelectorAll(".tab-btn");

  function render() {
    const state = Store.state;
    let html;
    if (state.activeTab === "race") html = Views.renderRace(state);
    else if (state.activeTab === "standings") html = Views.renderStandings(state);
    else html = Views.renderSettings(state);

    content.innerHTML = html;
    attachListeners(state.activeTab);

    tabButtons.forEach((btn) => btn.classList.toggle("active", btn.dataset.tab === state.activeTab));

    if (state.activeTab === "race") setupCarousel();
  }

  function attachListeners(tab) {
    if (tab === "standings") {
      content.querySelectorAll(".segmented button").forEach((btn) => {
        btn.addEventListener("click", () => Store.setStandingsMode(btn.dataset.mode));
      });
    }
    if (tab === "settings") {
      const favDriver = document.getElementById("favDriverSelect");
      const favConstructor = document.getElementById("favConstructorSelect");
      const refreshBtn = document.getElementById("refreshBtn");
      favDriver?.addEventListener("change", (e) => Store.setSetting("favoriteDriverId", e.target.value || null));
      favConstructor?.addEventListener("change", (e) => Store.setSetting("favoriteConstructorId", e.target.value || null));
      refreshBtn?.addEventListener("click", () => Store.refresh());
    }
  }

  function setupCarousel() {
    const carousel = document.getElementById("raceCarousel");
    const label = document.getElementById("carouselLabel");
    const prevBtn = document.getElementById("prevRaceBtn");
    const nextBtn = document.getElementById("nextRaceBtn");
    if (!carousel) return;

    const items = Array.from(carousel.children);

    // Default to the next race, no animation.
    const nextIndex = items.findIndex((el) => el.dataset.isNext === "1");
    if (nextIndex >= 0) {
      carousel.scrollLeft = nextIndex * carousel.clientWidth;
    }

    function updateLabel() {
      const index = Math.round(carousel.scrollLeft / carousel.clientWidth);
      const clamped = Math.max(0, Math.min(items.length - 1, index));
      const round = items[clamped]?.dataset.round;
      if (round && label) label.textContent = `Round ${round} of ${items.length}`;
      return clamped;
    }
    updateLabel();

    let scrollTimeout;
    carousel.addEventListener("scroll", () => {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(updateLabel, 100);
    });

    prevBtn?.addEventListener("click", () => {
      const index = Math.max(0, updateLabel() - 1);
      carousel.scrollTo({ left: index * carousel.clientWidth, behavior: "smooth" });
    });
    nextBtn?.addEventListener("click", () => {
      const index = Math.min(items.length - 1, updateLabel() + 1);
      carousel.scrollTo({ left: index * carousel.clientWidth, behavior: "smooth" });
    });
  }

  // Keep the countdown ticking without rebuilding the carousel (which would reset scroll position).
  function tickCountdown() {
    if (Store.state.activeTab !== "race") return;
    const el = content.querySelector(".next-up-countdown");
    const race = Store.state.snapshot ? F1Api.nextRace(Store.state.snapshot.races) : null;
    const next = race ? F1Api.nextSession(race) : null;
    if (el && next) el.textContent = DateFmt.countdown(next.date);
  }

  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => Store.setTab(btn.dataset.tab));
  });

  Store.subscribe(render);
  Store.init();
  render();
  Store.refresh();

  setInterval(tickCountdown, 30000);

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("service-worker.js").catch(() => {});
    });
  }
})();
