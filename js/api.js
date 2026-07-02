const F1Api = (() => {
  const BASE = "https://api.jolpi.ca/ergast/f1";

  function parseDate(dateStr, timeStr) {
    if (!timeStr) return new Date(`${dateStr}T00:00:00Z`);
    const t = timeStr.endsWith("Z") ? timeStr : `${timeStr}Z`;
    return new Date(`${dateStr}T${t}`);
  }

  function mapRace(dto) {
    const sessions = [];
    const add = (name, s) => {
      if (!s) return;
      sessions.push({ name, date: parseDate(s.date, s.time) });
    };
    add("First Practice", dto.FirstPractice);
    add("Second Practice", dto.SecondPractice);
    add("Third Practice", dto.ThirdPractice);
    add("Sprint", dto.Sprint);
    add("Qualifying", dto.Qualifying);
    if (dto.date) sessions.push({ name: "Race", date: parseDate(dto.date, dto.time) });
    sessions.sort((a, b) => a.date - b.date);

    return {
      season: dto.season,
      round: dto.round,
      raceName: dto.raceName,
      circuitId: dto.Circuit.circuitId,
      circuitName: dto.Circuit.circuitName,
      locality: dto.Circuit.Location.locality,
      country: dto.Circuit.Location.country,
      sessions,
    };
  }

  function raceSession(race) {
    return race.sessions.find((s) => s.name === "Race");
  }

  function nextSession(race, now = new Date()) {
    const upcoming = race.sessions.filter((s) => s.date > now);
    if (upcoming.length === 0) return null;
    return upcoming.reduce((a, b) => (a.date < b.date ? a : b));
  }

  function nextRace(races, now = new Date()) {
    return races.find((r) => {
      const rs = raceSession(r);
      const ns = nextSession(r, now);
      return (rs && rs.date > now) || (ns && ns.date > now);
    }) || null;
  }

  async function fetchSeasonSchedule() {
    const res = await fetch(`${BASE}/current.json`);
    if (!res.ok) throw new Error("bad response");
    const data = await res.json();
    return data.MRData.RaceTable.Races.map(mapRace);
  }

  async function fetchDriverStandings() {
    const res = await fetch(`${BASE}/current/driverStandings.json`);
    if (!res.ok) throw new Error("bad response");
    const data = await res.json();
    const list = data.MRData.StandingsTable.StandingsLists[0]?.DriverStandings || [];
    return list.map((e) => ({
      position: parseInt(e.position, 10),
      points: parseFloat(e.points),
      wins: parseInt(e.wins, 10),
      driverId: e.Driver.driverId,
      code: e.Driver.code || e.Driver.familyName.slice(0, 3).toUpperCase(),
      carNumber: e.Driver.permanentNumber || "-",
      givenName: e.Driver.givenName,
      familyName: e.Driver.familyName,
      constructorId: e.Constructors[0]?.constructorId || "",
      constructorName: e.Constructors[0]?.name || "",
    }));
  }

  async function fetchConstructorStandings() {
    const res = await fetch(`${BASE}/current/constructorStandings.json`);
    if (!res.ok) throw new Error("bad response");
    const data = await res.json();
    const list = data.MRData.StandingsTable.StandingsLists[0]?.ConstructorStandings || [];
    return list.map((e) => ({
      position: parseInt(e.position, 10),
      points: parseFloat(e.points),
      wins: parseInt(e.wins, 10),
      constructorId: e.Constructor.constructorId,
      name: e.Constructor.name,
    }));
  }

  async function fetchRaceResults(round) {
    const res = await fetch(`${BASE}/current/${round}/results.json`);
    if (!res.ok) throw new Error("bad response");
    const data = await res.json();
    const results = data.MRData.RaceTable.Races[0]?.Results || [];
    return results.map((r) => ({
      position: parseInt(r.position, 10),
      driverId: r.Driver.driverId,
      code: r.Driver.code || r.Driver.familyName.slice(0, 3).toUpperCase(),
      givenName: r.Driver.givenName,
      familyName: r.Driver.familyName,
      constructorId: r.Constructor.constructorId,
      constructorName: r.Constructor.name,
      status: r.status,
    }));
  }

  async function fetchSnapshot() {
    const [races, driverStandings, constructorStandings] = await Promise.all([
      fetchSeasonSchedule(),
      fetchDriverStandings(),
      fetchConstructorStandings(),
    ]);

    const now = new Date();
    const pastRounds = races.filter((r) => {
      const rs = raceSession(r);
      return rs && rs.date < now;
    });
    const resultsEntries = await Promise.all(
      pastRounds.map(async (r) => {
        try {
          return [r.round, await fetchRaceResults(r.round)];
        } catch (_) {
          return [r.round, null];
        }
      })
    );
    const resultsByRound = Object.fromEntries(resultsEntries.filter(([, v]) => v));

    return { fetchedAt: new Date().toISOString(), races, driverStandings, constructorStandings, resultsByRound };
  }

  return { fetchSnapshot, nextRace, nextSession, raceSession };
})();

const DateFmt = (() => {
  function countdown(date, now = new Date()) {
    const ms = date - now;
    if (ms <= 0) return "Live / finished";
    const totalMin = Math.floor(ms / 60000);
    const days = Math.floor(totalMin / 1440);
    const hours = Math.floor((totalMin % 1440) / 60);
    const minutes = totalMin % 60;
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  }

  const LOCALE = "en-GB";

  function shortDayTime(date) {
    return date.toLocaleString(LOCALE, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false });
  }

  function localTime(date) {
    return date.toLocaleString(LOCALE, { dateStyle: "medium", timeStyle: "short" });
  }

  const DURATIONS = { Race: 120, Sprint: 30, Qualifying: 60 };
  function durationMinutes(sessionName) {
    return DURATIONS[sessionName] ?? 60;
  }

  function timeRange(session) {
    const end = new Date(session.date.getTime() + durationMinutes(session.name) * 60000);
    const datePart = session.date.toLocaleDateString(LOCALE, { day: "numeric", month: "short" });
    const fmt = (d) => d.toLocaleTimeString(LOCALE, { hour: "2-digit", minute: "2-digit", hour12: false });
    return `${datePart}, ${fmt(session.date)} - ${fmt(end)}`;
  }

  const timeFmt = (d) => d.toLocaleTimeString(LOCALE, { hour: "2-digit", minute: "2-digit", hour12: false });

  function timeOnly(date) {
    return timeFmt(date);
  }

  function timeRangeOnly(session) {
    const end = new Date(session.date.getTime() + durationMinutes(session.name) * 60000);
    return `${timeFmt(session.date)} – ${timeFmt(end)}`;
  }

  function dayHeading(date) {
    return date.toLocaleDateString(LOCALE, { weekday: "long", day: "numeric", month: "long" });
  }

  return { countdown, shortDayTime, localTime, timeRange, timeOnly, timeRangeOnly, dayHeading };
})();
