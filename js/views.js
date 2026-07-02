const Views = (() => {
  const MEDALS = { 1: "🥇", 2: "🥈", 3: "🥉" };
  const sessionLabel = (name) => name;
  const SESSION_ICONS = { Race: "🏁", Qualifying: "⏱️", Sprint: "⚡" };
  const sessionIcon = (name) => SESSION_ICONS[name] || (name.includes("Practice") ? "🔧" : "🏎️");

  function trackBg(race) {
    return `<img class="race-track-bg" src="tracks/${race.circuitId}.svg" alt="" onerror="this.style.display='none'" />`;
  }

  function cardHeader(race) {
    return `
      <div class="race-card-top">
        <div>
          <div class="race-round">${Flags.emoji(race.country)} Round ${race.round}</div>
          <div class="race-locality">${race.locality}</div>
          <div class="race-name">${race.raceName}</div>
        </div>
      </div>
    `;
  }

  function groupSessionsByDay(sessions) {
    const groups = [];
    let current = null;
    for (const s of sessions) {
      const dayKey = s.date.toDateString();
      if (!current || current.dayKey !== dayKey) {
        current = { dayKey, dayLabel: DateFmt.dayHeading(s.date), sessions: [] };
        groups.push(current);
      }
      current.sessions.push(s);
    }
    return groups;
  }

  function scheduleCard(race, { isNext }) {
    const next = F1Api.nextSession(race);
    const sessionsHtml = groupSessionsByDay(race.sessions)
      .map((group) => {
        const rows = group.sessions
          .map((s) => {
            const isRace = s.name === "Race";
            const time = isRace ? DateFmt.timeOnly(s.date) : DateFmt.timeRangeOnly(s);
            return `<li class="day-session-row ${isRace ? "is-race" : ""}">
              <span class="day-session-icon">${sessionIcon(s.name)}</span>
              <span class="day-session-time">${time}</span>
              <span class="day-session-sep">—</span>
              <span class="day-session-name">${sessionLabel(s.name)}</span>
            </li>`;
          })
          .join("");
        return `<div class="day-group">
          <div class="day-header">${group.dayLabel}</div>
          <ul class="day-session-list">${rows}</ul>
        </div>`;
      })
      .join("");

    return `
      <div class="race-card ${isNext ? "is-next" : ""}">
        ${trackBg(race)}
        <div class="race-card-content">
          ${cardHeader(race)}
          ${
            isNext && next
              ? `<div class="next-up-label">Next up: ${sessionLabel(next.name)}</div>
                 <div class="next-up-countdown">${DateFmt.countdown(next.date)}</div>`
              : ""
          }
          <hr class="race-divider" />
          ${sessionsHtml}
        </div>
      </div>
    `;
  }

  function resultCard(race, results) {
    const raceSession = F1Api.raceSession(race);
    const podium = (results || []).slice(0, 3);
    const podiumHtml = podium.length
      ? podium
          .map(
            (r) => `
        <div class="podium-row">
          <span class="podium-medal">${MEDALS[r.position] || r.position}</span>
          <span class="podium-name">${r.givenName} ${r.familyName}</span>
          <span class="podium-team" style="color:${TeamColors.color(r.constructorId)}">${r.constructorName}</span>
        </div>`
          )
          .join("")
      : `<div class="podium-empty">Results not available yet</div>`;

    return `
      <div class="race-card is-past">
        ${trackBg(race)}
        <div class="race-card-content">
          ${cardHeader(race)}
          <div class="past-race-date">${raceSession ? DateFmt.shortDayTime(raceSession.date) : ""}</div>
          <hr class="race-divider" />
          ${podiumHtml}
        </div>
      </div>
    `;
  }

  function renderRace(state) {
    const snapshot = state.snapshot;
    if (state.isLoading && !snapshot) {
      return `<div class="empty-state">Loading schedule…</div>`;
    }
    if (!snapshot || !snapshot.races?.length) {
      return `<div class="empty-state">${state.lastError || "No race data yet. Pull to refresh once you're online."}</div>`;
    }

    const now = new Date();
    const nextRace = F1Api.nextRace(snapshot.races);
    const total = snapshot.races.length;

    const items = snapshot.races
      .map((race) => {
        const rs = F1Api.raceSession(race);
        const isPast = rs && rs.date < now;
        const isNext = nextRace && race.round === nextRace.round;
        const card = isPast
          ? resultCard(race, snapshot.resultsByRound?.[race.round])
          : scheduleCard(race, { isNext });
        return `<div class="race-carousel-item" data-round="${race.round}" data-is-next="${isNext ? "1" : "0"}">${card}</div>`;
      })
      .join("");

    return `
      <div class="carousel-nav">
        <button class="nav-arrow" id="prevRaceBtn" aria-label="Previous race">‹</button>
        <span class="carousel-label" id="carouselLabel">Round ${nextRace ? nextRace.round : "-"} of ${total}</span>
        <button class="nav-arrow" id="nextRaceBtn" aria-label="Next race">›</button>
      </div>
      <div class="race-carousel" id="raceCarousel">${items}</div>
    `;
  }

  function standingRow({ pos, teamId, number, name, subtitle, points, isFavorite }) {
    const color = TeamColors.color(teamId);
    return `
      <div class="standing-row ${isFavorite ? "favorite" : ""}" style="border-left-color:${color}; --team-color:${color}">
        <span class="standing-pos">${pos}</span>
        ${number !== undefined ? `<span class="standing-number">${number}</span>` : ""}
        <div class="standing-name-block">
          <div class="standing-name">${name}</div>
          ${subtitle ? `<div class="standing-team">${subtitle}</div>` : ""}
        </div>
        <div class="standing-points">${Math.round(points)}<span class="pts-label"> PTS</span></div>
      </div>
    `;
  }

  function renderStandings(state) {
    const snapshot = state.snapshot;
    const favDriver = Store.getSetting("favoriteDriverId", "");
    const favConstructor = Store.getSetting("favoriteConstructorId", "");

    const segmented = `
      <div class="segmented">
        <button data-mode="drivers" class="${state.standingsMode === "drivers" ? "active" : ""}">Drivers</button>
        <button data-mode="constructors" class="${state.standingsMode === "constructors" ? "active" : ""}">Constructors</button>
      </div>
    `;

    if (!snapshot) {
      return segmented + `<div class="empty-state">${state.lastError || "No standings yet."}</div>`;
    }

    let rows;
    if (state.standingsMode === "drivers") {
      rows = snapshot.driverStandings
        .map((d) =>
          standingRow({
            pos: d.position,
            teamId: d.constructorId,
            number: d.carNumber,
            name: `${d.givenName} ${d.familyName}`,
            subtitle: d.constructorName,
            points: d.points,
            isFavorite: d.driverId === favDriver,
          })
        )
        .join("");
    } else {
      rows = snapshot.constructorStandings
        .map((c) =>
          standingRow({
            pos: c.position,
            teamId: c.constructorId,
            name: c.name,
            points: c.points,
            isFavorite: c.constructorId === favConstructor,
          })
        )
        .join("");
    }

    return segmented + `<div class="standings-list">${rows}</div>`;
  }

  function selectRow({ id, icon, label, options, selectedValue, selectedLabel, selectedColor }) {
    const optionsHtml = options
      .map((o) => `<option value="${o.value}" ${o.value === selectedValue ? "selected" : ""}>${o.label}</option>`)
      .join("");
    const dot = selectedColor ? `<span class="settings-value-dot" style="background:${selectedColor}"></span>` : "";
    return `
      <div class="settings-row settings-row-select">
        <span class="settings-row-icon">${icon}</span>
        <span class="settings-row-label">${label}</span>
        <span class="settings-row-value">${dot}${selectedLabel}</span>
        <span class="settings-chevron">⌄</span>
        <select id="${id}" class="settings-native-select" aria-label="${label}">
          <option value="">None</option>
          ${optionsHtml}
        </select>
      </div>
    `;
  }

  function renderSettings(state) {
    const snapshot = state.snapshot;
    const favDriverId = Store.getSetting("favoriteDriverId", "");
    const favConstructorId = Store.getSetting("favoriteConstructorId", "");

    const driverList = snapshot?.driverStandings || [];
    const constructorList = snapshot?.constructorStandings || [];
    const favDriver = driverList.find((d) => d.driverId === favDriverId);
    const favConstructor = constructorList.find((c) => c.constructorId === favConstructorId);

    const lastUpdated = snapshot?.fetchedAt ? DateFmt.localTime(new Date(snapshot.fetchedAt)) : null;

    return `
      <div class="settings-list">
        <div class="settings-hero">
          <img src="icons/icon-192.png" class="settings-app-icon" alt="" />
          <div>
            <div class="settings-app-name">F1 Companion</div>
            <div class="settings-app-tagline">Schedule, results &amp; standings</div>
          </div>
        </div>

        <div class="settings-section">
          <h2>Favorites</h2>
          ${selectRow({
            id: "favDriverSelect",
            icon: "🏎️",
            label: "Favorite driver",
            options: driverList.map((d) => ({ value: d.driverId, label: `${d.givenName} ${d.familyName}` })),
            selectedValue: favDriverId,
            selectedLabel: favDriver ? `${favDriver.givenName} ${favDriver.familyName}` : "None",
            selectedColor: favDriver ? TeamColors.color(favDriver.constructorId) : null,
          })}
          ${selectRow({
            id: "favConstructorSelect",
            icon: "🏆",
            label: "Favorite team",
            options: constructorList.map((c) => ({ value: c.constructorId, label: c.name })),
            selectedValue: favConstructorId,
            selectedLabel: favConstructor ? favConstructor.name : "None",
            selectedColor: favConstructor ? TeamColors.color(favConstructor.constructorId) : null,
          })}
        </div>

        <div class="settings-section">
          <h2>Data</h2>
          <button class="settings-row settings-row-button" id="refreshBtn" ${state.isLoading ? "disabled" : ""}>
            <span class="settings-row-icon ${state.isLoading ? "spinning" : ""}">🔄</span>
            <span class="settings-row-label">${state.isLoading ? "Refreshing…" : "Refresh now"}</span>
            ${lastUpdated ? `<span class="settings-row-value settings-row-value-small">Updated ${lastUpdated}</span>` : ""}
          </button>
        </div>

        <div class="settings-section">
          <h2>About</h2>
          <div class="settings-row settings-row-static">
            <span class="settings-row-icon">🏁</span>
            <span class="settings-row-label">Race data</span>
            <span class="settings-row-value">Jolpica-F1</span>
          </div>
          <div class="settings-row settings-row-static">
            <span class="settings-row-icon">🗺️</span>
            <span class="settings-row-label">Circuit layouts</span>
            <span class="settings-row-value settings-row-value-small">© f1db, CC BY 4.0</span>
          </div>
        </div>
      </div>
    `;
  }

  return { renderRace, renderStandings, renderSettings };
})();
