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

  // Custom pull-to-refresh: the indicator lives outside #content (a sibling
  // in .content-wrapper) so re-renders never wipe it out mid-gesture.
  function setupPullToRefresh() {
    const indicator = document.getElementById("pullIndicator");
    if (!indicator) return;

    const THRESHOLD = 64;
    let startX = 0;
    let startY = 0;
    let tracking = false;
    let dragging = false;
    let refreshing = false;

    function reset() {
      indicator.style.transform = "";
      indicator.style.opacity = "";
      indicator.style.removeProperty("--pull-rotate");
    }

    content.addEventListener(
      "touchstart",
      (e) => {
        if (refreshing || content.scrollTop > 0) {
          tracking = false;
          return;
        }
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
        tracking = true;
        dragging = false;
      },
      { passive: true }
    );

    content.addEventListener(
      "touchmove",
      (e) => {
        if (!tracking || refreshing) return;
        const dx = e.touches[0].clientX - startX;
        const dy = e.touches[0].clientY - startY;

        if (!dragging) {
          if (Math.abs(dy) < 8 && Math.abs(dx) < 8) return;
          dragging = Math.abs(dy) > Math.abs(dx) && dy > 0;
          if (!dragging) {
            tracking = false;
            return;
          }
        }
        if (dy <= 0) return;

        const pull = Math.min(dy * 0.5, THRESHOLD * 1.4);
        indicator.style.transform = `translateY(${pull - 56}px)`;
        indicator.style.opacity = String(Math.min(pull / THRESHOLD, 1));
        indicator.style.setProperty("--pull-rotate", `${(pull / THRESHOLD) * 180}deg`);
        indicator.classList.toggle("ready", pull >= THRESHOLD);
      },
      { passive: true }
    );

    content.addEventListener("touchend", async () => {
      if (!tracking || refreshing) {
        tracking = false;
        return;
      }
      tracking = false;
      const ready = indicator.classList.contains("ready");
      if (!ready) {
        reset();
        return;
      }
      refreshing = true;
      indicator.classList.add("refreshing");
      indicator.style.transform = "translateY(0px)";
      indicator.style.opacity = "1";
      await Store.refresh();
      refreshing = false;
      indicator.classList.remove("refreshing", "ready");
      reset();
    });
  }

  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => Store.setTab(btn.dataset.tab));
  });

  Store.subscribe(render);
  Store.init();
  render();
  setupPullToRefresh();
  Store.refresh();

  setInterval(tickCountdown, 30000);

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("service-worker.js").catch(() => {});
    });
  }
})();
