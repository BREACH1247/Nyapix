const ical = require("node-ical");

function normalizeUrl(raw) {
  return String(raw || "")
    .trim()
    .replace(/^webcal:/i, "https:");
}

function isAllDay(ev, date) {
  if (ev?.datetype === "date") return true;
  if (date && typeof date === "object" && date.dateOnly) return true;
  return false;
}

function eventTitle(ev) {
  const t = String(ev?.summary || "event").replace(/\s+/g, " ").trim();
  return t.slice(0, 48) || "event";
}

function skipEvent(ev) {
  if (!ev || ev.type !== "VEVENT") return true;
  const status = String(ev.status || "").toUpperCase();
  return status === "CANCELLED";
}

function collectStarts(ev, from, to) {
  const starts = [];
  if (ev.rrule && typeof ev.rrule.between === "function") {
    try {
      const dates = ev.rrule.between(from, to, true);
      const ex = new Set();
      if (ev.exdate) {
        for (const v of Object.values(ev.exdate)) {
          const d = new Date(v);
          if (!Number.isNaN(+d)) ex.add(d.toISOString().slice(0, 16));
        }
      }
      for (const d of dates) {
        const dt = new Date(d);
        if (Number.isNaN(+dt)) continue;
        if (ex.has(dt.toISOString().slice(0, 16))) continue;
        starts.push(dt);
      }
    } catch {
      /* ignore bad rrule */
    }
    return starts;
  }
  if (ev.start) {
    const d = new Date(ev.start);
    if (!Number.isNaN(+d) && d >= from && d <= to) starts.push(d);
  }
  return starts;
}

function upcomingFromData(data, now = new Date()) {
  const from = new Date(now.getTime() - 2 * 60 * 1000);
  const to = new Date(now.getTime() + 36 * 60 * 60 * 1000);
  const out = [];
  for (const ev of Object.values(data || {})) {
    if (skipEvent(ev)) continue;
    const title = eventTitle(ev);
    const uid = String(ev.uid || title);
    const allDay = isAllDay(ev, ev.start);
    for (const start of collectStarts(ev, from, to)) {
      out.push({
        uid,
        title,
        start: start.toISOString(),
        at: +start,
        allDay,
      });
    }
  }
  out.sort((a, b) => a.at - b.at);
  const seen = new Set();
  return out.filter((ev) => {
    const k = `${ev.uid}|${ev.start}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  }).slice(0, 16);
}

async function fetchCalendar(url) {
  const href = normalizeUrl(url);
  if (!/^https:\/\//i.test(href)) throw new Error("need an https calendar link");
  const res = await fetch(href, {
    headers: { "User-Agent": "Nyapix/0.1", Accept: "text/calendar, text/plain, */*" },
  });
  if (!res.ok) throw new Error(`google returned ${res.status}`);
  const text = await res.text();
  if (!/BEGIN:VCALENDAR/i.test(text)) throw new Error("that link is not a calendar");
  return ical.parseICS(text);
}

function startCalendar({ getSettings, onRemind }) {
  let timer = null;
  let events = [];
  let lastError = "";
  let lastSync = 0;
  const fired = new Set();

  async function refresh() {
    const s = getSettings() || {};
    const url = normalizeUrl(s.calendarUrl);
    if (!url) {
      events = [];
      lastError = "";
      return;
    }
    try {
      const data = await fetchCalendar(url);
      events = upcomingFromData(data);
      lastError = "";
      lastSync = Date.now();
    } catch (err) {
      lastError = err?.message || "could not sync";
    }
  }

  function tick() {
    const s = getSettings() || {};
    if (s.paused) return;
    const url = normalizeUrl(s.calendarUrl);
    if (!url) return;
    const lead = Math.max(0, Math.min(120, Number(s.calendarMinutes) || 10));
    const now = Date.now();
    for (const ev of events) {
      if (ev.allDay) continue;
      const mins = Math.round((ev.at - now) / 60000);
      if (mins > lead || mins < -1) continue;
      const key = `${ev.uid}|${ev.start}|${lead}`;
      if (fired.has(key)) continue;
      fired.add(key);
      onRemind?.({
        title: ev.title,
        minutes: Math.max(0, mins),
        start: ev.start,
      });
    }
    for (const key of [...fired]) {
      const start = Date.parse(key.split("|")[1] || "");
      if (start && now - start > 6 * 60 * 60 * 1000) fired.delete(key);
    }
  }

  refresh();
  timer = setInterval(() => {
    tick();
    if (!lastSync || Date.now() - lastSync > 5 * 60 * 1000) refresh();
  }, 20 * 1000);

  return {
    refresh,
    upcoming() {
      return {
        events: events.slice(0, 8).map(({ title, start, allDay }) => ({ title, start, allDay })),
        error: lastError,
        syncedAt: lastSync,
      };
    },
    stop() {
      if (timer) clearInterval(timer);
      timer = null;
    },
  };
}

module.exports = { startCalendar, fetchCalendar, upcomingFromData, normalizeUrl };
