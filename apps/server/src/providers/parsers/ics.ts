/**
 * Focused ICS/iCalendar parser for calendar widgets.
 * Supports VEVENT, VTIMEZONE offsets, common RRULE frequencies, all-day
 * VALUE=DATE, EXDATE, and CLASS privacy markers. Not a full RFC 5545 suite.
 */

export class IcsParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IcsParseError";
  }
}

export type IcsClassification = "PUBLIC" | "PRIVATE" | "CONFIDENTIAL" | "UNKNOWN";

export type ParsedIcsEvent = {
  uid: string;
  summary?: string;
  description?: string;
  location?: string;
  classification: IcsClassification;
  /** Inclusive start as UTC ISO-8601. For all-day events this is midnight UTC of the date. */
  startsAt: string;
  /** Exclusive end as UTC ISO-8601. */
  endsAt: string;
  allDay: boolean;
  /** Original floating/local date key YYYY-MM-DD for all-day events. */
  allDayDate?: string;
};

export type ParsedIcsCalendar = {
  calendarName?: string;
  timezone?: string;
  events: ParsedIcsEvent[];
};

type PropParams = Record<string, string>;

type RawProp = {
  name: string;
  params: PropParams;
  value: string;
};

type RawComponent = {
  name: string;
  props: RawProp[];
  children: RawComponent[];
};

type Instant = {
  utcMs: number;
  allDay: boolean;
  /** YYYY-MM-DD when allDay */
  dateKey?: string;
  tzid?: string;
};

type RRule = {
  freq: "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";
  interval: number;
  count?: number;
  untilMs?: number;
  byDay?: Array<{ weekday: number; nth?: number }>;
  byMonthDay?: number[];
};

type MasterEvent = {
  uid: string;
  summary?: string;
  description?: string;
  location?: string;
  classification: IcsClassification;
  dtstart: Instant;
  dtend: Instant;
  rrule?: RRule;
  exdates: Set<string>;
};

const WEEKDAY_MAP: Record<string, number> = {
  SU: 0,
  MO: 1,
  TU: 2,
  WE: 3,
  TH: 4,
  FR: 5,
  SA: 6,
};

function unfold(raw: string): string[] {
  const normalized = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = normalized.split("\n");
  const out: string[] = [];
  for (const line of lines) {
    if ((line.startsWith(" ") || line.startsWith("\t")) && out.length > 0) {
      out[out.length - 1] = `${out[out.length - 1]}${line.slice(1)}`;
    } else {
      out.push(line);
    }
  }
  return out.filter((line) => line.length > 0);
}

function unescapeIcs(value: string): string {
  return value
    .replace(/\\n/gi, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\");
}

function parsePropLine(line: string): RawProp | null {
  const colon = line.indexOf(":");
  if (colon <= 0) {
    return null;
  }
  const left = line.slice(0, colon);
  const value = line.slice(colon + 1);
  const segments = left.split(";");
  const name = (segments[0] ?? "").toUpperCase();
  if (!name) {
    return null;
  }
  const params: PropParams = {};
  for (let i = 1; i < segments.length; i++) {
    const segment = segments[i] ?? "";
    const eq = segment.indexOf("=");
    if (eq <= 0) {
      continue;
    }
    params[segment.slice(0, eq).toUpperCase()] = segment.slice(eq + 1);
  }
  return { name, params, value };
}

function parseComponents(lines: string[]): RawComponent {
  const root: RawComponent = { name: "ROOT", props: [], children: [] };
  const stack: RawComponent[] = [root];

  for (const line of lines) {
    const upper = line.toUpperCase();
    if (upper.startsWith("BEGIN:")) {
      const name = upper.slice("BEGIN:".length).trim();
      const component: RawComponent = { name, props: [], children: [] };
      const parent = stack[stack.length - 1];
      if (!parent) {
        throw new IcsParseError("ICS component stack underflow");
      }
      parent.children.push(component);
      stack.push(component);
      continue;
    }
    if (upper.startsWith("END:")) {
      const name = upper.slice("END:".length).trim();
      const current = stack[stack.length - 1];
      if (!current || current === root) {
        throw new IcsParseError(`Unexpected END:${name}`);
      }
      if (current.name !== name) {
        throw new IcsParseError(`Mismatched END:${name} (open ${current.name})`);
      }
      stack.pop();
      continue;
    }
    const current = stack[stack.length - 1];
    if (!current) {
      throw new IcsParseError("ICS component stack underflow");
    }
    const prop = parsePropLine(line);
    if (prop) {
      current.props.push(prop);
    }
  }

  if (stack.length !== 1) {
    throw new IcsParseError("Unclosed ICS component");
  }
  return root;
}

function findProps(component: RawComponent, name: string): RawProp[] {
  return component.props.filter((prop) => prop.name === name);
}

function findProp(component: RawComponent, name: string): RawProp | undefined {
  return findProps(component, name)[0];
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function dateKeyFromParts(year: number, month: number, day: number): string {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function parseDateKey(value: string): { year: number; month: number; day: number } | null {
  if (!/^\d{8}$/.test(value)) {
    return null;
  }
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(4, 6));
  const day = Number(value.slice(6, 8));
  if (!Number.isFinite(year) || month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }
  return { year, month, day };
}

/** Convert a wall-clock local time in an IANA zone to UTC milliseconds. */
export function zonedLocalToUtcMs(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  timeZone: string,
): number {
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, second);
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const parts = dtf.formatToParts(new Date(utcGuess));
  const read = (type: Intl.DateTimeFormatPartTypes): number => {
    const part = parts.find((entry) => entry.type === type)?.value;
    return Number(part);
  };
  const asUtc = Date.UTC(
    read("year"),
    read("month") - 1,
    read("day"),
    read("hour"),
    read("minute"),
    read("second"),
  );
  return utcGuess - (asUtc - utcGuess);
}

function isIanaTimeZone(value: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

type TzRule = {
  offsetMinutes: number;
  /** Month-day roughly when this rule starts each year (1-366), for ordering. */
  sortKey: number;
};

function parseUtcOffset(value: string): number | null {
  const match = /^(?:UTC)?([+-])(\d{2})(\d{2})(\d{2})?$/i.exec(value.trim());
  if (!match) {
    return null;
  }
  const sign = match[1] === "-" ? -1 : 1;
  const hours = Number(match[2]);
  const minutes = Number(match[3]);
  const seconds = Number(match[4] ?? "0");
  return sign * (hours * 60 + minutes + Math.trunc(seconds / 60));
}

function buildTimezoneOffsets(vtimezones: RawComponent[]): Map<string, TzRule[]> {
  const map = new Map<string, TzRule[]>();
  for (const zone of vtimezones) {
    const tzid = findProp(zone, "TZID")?.value;
    if (!tzid) {
      continue;
    }
    const rules: TzRule[] = [];
    for (const child of zone.children) {
      if (child.name !== "STANDARD" && child.name !== "DAYLIGHT") {
        continue;
      }
      const offsetFrom = findProp(child, "TZOFFSETTO")?.value;
      const dtStart = findProp(child, "DTSTART")?.value;
      if (!offsetFrom) {
        continue;
      }
      const offsetMinutes = parseUtcOffset(offsetFrom);
      if (offsetMinutes === null) {
        continue;
      }
      let sortKey = 0;
      if (dtStart && dtStart.length >= 8) {
        const month = Number(dtStart.slice(4, 6));
        const day = Number(dtStart.slice(6, 8));
        if (Number.isFinite(month) && Number.isFinite(day)) {
          sortKey = month * 32 + day;
        }
      }
      rules.push({ offsetMinutes, sortKey });
    }
    if (rules.length > 0) {
      map.set(tzid, rules);
    }
  }
  return map;
}

function offsetForTzid(
  tzid: string | undefined,
  utcMs: number,
  customZones: Map<string, TzRule[]>,
): number | null {
  if (!tzid) {
    return 0;
  }
  if (isIanaTimeZone(tzid)) {
    // Handled by zonedLocalToUtcMs — signal "use IANA".
    return null;
  }
  const rules = customZones.get(tzid);
  if (!rules || rules.length === 0) {
    return 0;
  }
  if (rules.length === 1) {
    return rules[0]?.offsetMinutes ?? 0;
  }
  // Pick the rule with the largest sortKey that has started this year (approx).
  const date = new Date(utcMs);
  const key = (date.getUTCMonth() + 1) * 32 + date.getUTCDate();
  const sorted = [...rules].sort((a, b) => a.sortKey - b.sortKey);
  let chosen = sorted[0]?.offsetMinutes ?? 0;
  for (const rule of sorted) {
    if (rule.sortKey <= key) {
      chosen = rule.offsetMinutes;
    }
  }
  return chosen;
}

function parseDateTimeValue(
  prop: RawProp,
  customZones: Map<string, TzRule[]>,
  defaultTzid?: string,
): Instant {
  const raw = prop.value.trim();
  const tzid = prop.params["TZID"] ?? defaultTzid;
  const valueType = (prop.params["VALUE"] ?? "").toUpperCase();
  const isDateOnly = valueType === "DATE" || (/^\d{8}$/.test(raw) && !raw.includes("T"));

  if (isDateOnly) {
    const parts = parseDateKey(raw.slice(0, 8));
    if (!parts) {
      throw new IcsParseError(`Invalid DATE value: ${raw}`);
    }
    const utcMs = Date.UTC(parts.year, parts.month - 1, parts.day, 0, 0, 0);
    return {
      utcMs,
      allDay: true,
      dateKey: dateKeyFromParts(parts.year, parts.month, parts.day),
      ...(tzid ? { tzid } : {}),
    };
  }

  const match =
    /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/i.exec(raw) ??
    /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})$/i.exec(raw);
  if (!match) {
    throw new IcsParseError(`Invalid DATE-TIME value: ${raw}`);
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const isUtc = Boolean(match[7]) || raw.endsWith("Z");

  if (isUtc) {
    return { utcMs: Date.UTC(year, month - 1, day, hour, minute, second), allDay: false };
  }

  if (tzid && isIanaTimeZone(tzid)) {
    return {
      utcMs: zonedLocalToUtcMs(year, month, day, hour, minute, second, tzid),
      allDay: false,
      tzid,
    };
  }

  const localAsUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  const offset = offsetForTzid(tzid, localAsUtc, customZones);
  const utcMs = offset === null ? localAsUtc : localAsUtc - offset * 60_000;
  return {
    utcMs,
    allDay: false,
    ...(tzid ? { tzid } : {}),
  };
}

function parseDurationMs(value: string): number | null {
  const match = /^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/i.exec(
    value.trim(),
  );
  if (!match) {
    return null;
  }
  const sign = match[1] === "-" ? -1 : 1;
  const weeks = Number(match[2] ?? 0);
  const days = Number(match[3] ?? 0);
  const hours = Number(match[4] ?? 0);
  const minutes = Number(match[5] ?? 0);
  const seconds = Number(match[6] ?? 0);
  return (
    sign * (((weeks * 7 + days) * 24 * 60 * 60 + hours * 60 * 60 + minutes * 60 + seconds) * 1000)
  );
}

function addDaysToDateKey(dateKey: string, days: number): string {
  const parts = dateKey.split("-").map(Number);
  const year = parts[0] ?? 1970;
  const month = parts[1] ?? 1;
  const day = parts[2] ?? 1;
  const ms = Date.UTC(year, month - 1, day + days);
  const d = new Date(ms);
  return dateKeyFromParts(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

function parseClassification(value: string | undefined): IcsClassification {
  const upper = (value ?? "PUBLIC").toUpperCase();
  if (upper === "PUBLIC" || upper === "PRIVATE" || upper === "CONFIDENTIAL") {
    return upper;
  }
  return "UNKNOWN";
}

function parseByDay(raw: string | undefined): RRule["byDay"] | undefined {
  if (!raw) {
    return undefined;
  }
  const out: NonNullable<RRule["byDay"]> = [];
  for (const part of raw.split(",")) {
    const match = /^([+-]?\d{1,2})?(SU|MO|TU|WE|TH|FR|SA)$/i.exec(part.trim());
    if (!match) {
      continue;
    }
    const weekday = WEEKDAY_MAP[match[2]?.toUpperCase() ?? ""];
    if (weekday === undefined) {
      continue;
    }
    const nthRaw = match[1];
    out.push({
      weekday,
      ...(nthRaw ? { nth: Number(nthRaw) } : {}),
    });
  }
  return out.length > 0 ? out : undefined;
}

function parseRRule(value: string): RRule | null {
  const parts = value
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean);
  const map = new Map<string, string>();
  for (const part of parts) {
    const eq = part.indexOf("=");
    if (eq <= 0) {
      continue;
    }
    map.set(part.slice(0, eq).toUpperCase(), part.slice(eq + 1));
  }
  const freqRaw = (map.get("FREQ") ?? "").toUpperCase();
  if (
    freqRaw !== "DAILY" &&
    freqRaw !== "WEEKLY" &&
    freqRaw !== "MONTHLY" &&
    freqRaw !== "YEARLY"
  ) {
    return null;
  }
  const interval = Math.max(1, Number(map.get("INTERVAL") ?? "1") || 1);
  const countRaw = map.get("COUNT");
  const untilRaw = map.get("UNTIL");
  let untilMs: number | undefined;
  if (untilRaw) {
    try {
      const instant = parseDateTimeValue(
        { name: "UNTIL", params: untilRaw.length === 8 ? { VALUE: "DATE" } : {}, value: untilRaw },
        new Map(),
      );
      untilMs = instant.utcMs;
    } catch {
      untilMs = undefined;
    }
  }
  const byDay = parseByDay(map.get("BYDAY"));
  const byMonthDayRaw = map.get("BYMONTHDAY");
  const byMonthDay = byMonthDayRaw
    ? byMonthDayRaw
        .split(",")
        .map((entry) => Number(entry))
        .filter((entry) => Number.isFinite(entry) && entry !== 0)
    : undefined;

  return {
    freq: freqRaw,
    interval,
    ...(countRaw ? { count: Math.max(1, Number(countRaw) || 1) } : {}),
    ...(untilMs !== undefined ? { untilMs } : {}),
    ...(byDay ? { byDay } : {}),
    ...(byMonthDay && byMonthDay.length > 0 ? { byMonthDay } : {}),
  };
}

function occurrenceKey(instant: Instant): string {
  if (instant.allDay && instant.dateKey) {
    return `D:${instant.dateKey}`;
  }
  return `T:${instant.utcMs}`;
}

function shiftInstant(instant: Instant, deltaMs: number): Instant {
  if (instant.allDay && instant.dateKey) {
    const days = Math.round(deltaMs / 86_400_000);
    const nextKey = addDaysToDateKey(instant.dateKey, days);
    const [y, m, d] = nextKey.split("-").map(Number);
    return {
      utcMs: Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1),
      allDay: true,
      dateKey: nextKey,
      ...(instant.tzid ? { tzid: instant.tzid } : {}),
    };
  }
  return {
    utcMs: instant.utcMs + deltaMs,
    allDay: false,
    ...(instant.tzid ? { tzid: instant.tzid } : {}),
  };
}

function durationOf(master: MasterEvent): number {
  return Math.max(0, master.dtend.utcMs - master.dtstart.utcMs);
}

function matchesByDay(date: Date, byDay: NonNullable<RRule["byDay"]>): boolean {
  const weekday = date.getUTCDay();
  return byDay.some((rule) => {
    if (rule.weekday !== weekday) {
      return false;
    }
    if (rule.nth === undefined) {
      return true;
    }
    const day = date.getUTCDate();
    if (rule.nth > 0) {
      return Math.floor((day - 1) / 7) + 1 === rule.nth;
    }
    // Negative nth: from end of month
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth();
    const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const fromEnd = lastDay - day + 1;
    return Math.floor((fromEnd - 1) / 7) + 1 === Math.abs(rule.nth);
  });
}

function nextCandidate(start: Instant, rule: RRule, index: number): Instant {
  switch (rule.freq) {
    case "DAILY":
      return shiftInstant(start, index * rule.interval * 86_400_000);
    case "WEEKLY":
      return shiftInstant(start, index * rule.interval * 7 * 86_400_000);
    case "MONTHLY": {
      if (start.allDay && start.dateKey) {
        const [y, m, d] = start.dateKey.split("-").map(Number);
        const year = y ?? 1970;
        const monthIndex = (m ?? 1) - 1 + index * rule.interval;
        const day = d ?? 1;
        const dt = new Date(Date.UTC(year, monthIndex, day));
        const key = dateKeyFromParts(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
        return { utcMs: dt.getTime(), allDay: true, dateKey: key };
      }
      const base = new Date(start.utcMs);
      const dt = new Date(
        Date.UTC(
          base.getUTCFullYear(),
          base.getUTCMonth() + index * rule.interval,
          base.getUTCDate(),
          base.getUTCHours(),
          base.getUTCMinutes(),
          base.getUTCSeconds(),
        ),
      );
      return { utcMs: dt.getTime(), allDay: false };
    }
    case "YEARLY": {
      if (start.allDay && start.dateKey) {
        const [y, m, d] = start.dateKey.split("-").map(Number);
        const dt = new Date(Date.UTC((y ?? 1970) + index * rule.interval, (m ?? 1) - 1, d ?? 1));
        const key = dateKeyFromParts(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
        return { utcMs: dt.getTime(), allDay: true, dateKey: key };
      }
      const base = new Date(start.utcMs);
      const dt = new Date(
        Date.UTC(
          base.getUTCFullYear() + index * rule.interval,
          base.getUTCMonth(),
          base.getUTCDate(),
          base.getUTCHours(),
          base.getUTCMinutes(),
          base.getUTCSeconds(),
        ),
      );
      return { utcMs: dt.getTime(), allDay: false };
    }
  }
}

function expandMaster(
  master: MasterEvent,
  rangeStartMs: number,
  rangeEndMs: number,
): ParsedIcsEvent[] {
  const duration = durationOf(master);
  const out: ParsedIcsEvent[] = [];

  const pushOccurrence = (start: Instant) => {
    const key = occurrenceKey(start);
    if (master.exdates.has(key)) {
      return;
    }
    const endUtc = start.utcMs + duration;
    // Include if overlaps [rangeStart, rangeEnd)
    if (endUtc <= rangeStartMs || start.utcMs >= rangeEndMs) {
      return;
    }
    const event: ParsedIcsEvent = {
      uid: master.uid,
      classification: master.classification,
      startsAt: new Date(start.utcMs).toISOString(),
      endsAt: new Date(endUtc).toISOString(),
      allDay: start.allDay,
      ...(master.summary !== undefined ? { summary: master.summary } : {}),
      ...(master.description !== undefined ? { description: master.description } : {}),
      ...(master.location !== undefined ? { location: master.location } : {}),
      ...(start.allDay && start.dateKey ? { allDayDate: start.dateKey } : {}),
    };
    out.push(event);
  };

  if (!master.rrule) {
    pushOccurrence(master.dtstart);
    return out;
  }

  const rule = master.rrule;
  const maxOccurrences = Math.min(rule.count ?? 400, 400);
  let emitted = 0;

  // Weekly + BYDAY: walk day-by-day so mid-week DTSTART still hits later weekdays.
  if (rule.freq === "WEEKLY" && rule.byDay && rule.byDay.length > 0) {
    let cursor = master.dtstart;
    for (let guard = 0; guard < 2500 && emitted < maxOccurrences; guard++) {
      if (cursor.utcMs > rangeEndMs + duration) {
        break;
      }
      if (rule.untilMs !== undefined && cursor.utcMs > rule.untilMs) {
        break;
      }
      const weekIndex = Math.floor(
        Math.max(0, cursor.utcMs - master.dtstart.utcMs) / (7 * 86_400_000),
      );
      if (weekIndex % rule.interval === 0 && matchesByDay(new Date(cursor.utcMs), rule.byDay)) {
        pushOccurrence(cursor);
        emitted += 1;
      }
      cursor = shiftInstant(cursor, 86_400_000);
    }
    return out;
  }

  for (let index = 0; index < maxOccurrences + 80 && emitted < maxOccurrences; index++) {
    const candidate = nextCandidate(master.dtstart, rule, index);
    if (rule.untilMs !== undefined && candidate.utcMs > rule.untilMs) {
      break;
    }
    if (candidate.utcMs > rangeEndMs + duration + 366 * 86_400_000) {
      break;
    }

    if (rule.byDay && rule.byDay.length > 0) {
      const date = new Date(candidate.utcMs);
      if (!matchesByDay(date, rule.byDay)) {
        continue;
      }
    }

    if (rule.byMonthDay && rule.byMonthDay.length > 0) {
      const day = new Date(candidate.utcMs).getUTCDate();
      if (!rule.byMonthDay.includes(day)) {
        continue;
      }
    }

    pushOccurrence(candidate);
    emitted += 1;
    if (rule.count !== undefined && emitted >= rule.count) {
      break;
    }
  }

  return out;
}

function parseExdate(prop: RawProp, customZones: Map<string, TzRule[]>): string[] {
  const keys: string[] = [];
  for (const part of prop.value.split(",")) {
    const trimmed = part.trim();
    if (!trimmed) {
      continue;
    }
    try {
      const instant = parseDateTimeValue(
        { name: "EXDATE", params: prop.params, value: trimmed },
        customZones,
      );
      keys.push(occurrenceKey(instant));
    } catch {
      // skip bad EXDATE parts
    }
  }
  return keys;
}

function parseVEvent(
  component: RawComponent,
  customZones: Map<string, TzRule[]>,
  defaultTzid?: string,
): MasterEvent | null {
  const uid = findProp(component, "UID")?.value?.trim();
  const dtStartProp = findProp(component, "DTSTART");
  if (!uid || !dtStartProp) {
    return null;
  }

  let dtstart: Instant;
  try {
    dtstart = parseDateTimeValue(dtStartProp, customZones, defaultTzid);
  } catch {
    return null;
  }

  let dtend: Instant;
  const dtEndProp = findProp(component, "DTEND");
  const durationProp = findProp(component, "DURATION");
  if (dtEndProp) {
    try {
      dtend = parseDateTimeValue(dtEndProp, customZones, defaultTzid);
    } catch {
      dtend = dtstart.allDay
        ? shiftInstant(dtstart, 86_400_000)
        : { utcMs: dtstart.utcMs + 3_600_000, allDay: false };
    }
  } else if (durationProp) {
    const ms = parseDurationMs(durationProp.value) ?? (dtstart.allDay ? 86_400_000 : 3_600_000);
    dtend = shiftInstant(dtstart, ms);
  } else {
    dtend = dtstart.allDay
      ? shiftInstant(dtstart, 86_400_000)
      : { utcMs: dtstart.utcMs + 3_600_000, allDay: false };
  }

  const summary = findProp(component, "SUMMARY")?.value;
  const description = findProp(component, "DESCRIPTION")?.value;
  const location = findProp(component, "LOCATION")?.value;
  const classification = parseClassification(findProp(component, "CLASS")?.value);

  const rruleProp = findProp(component, "RRULE");
  const rrule = rruleProp ? parseRRule(rruleProp.value) : undefined;

  const exdates = new Set<string>();
  for (const prop of findProps(component, "EXDATE")) {
    for (const key of parseExdate(prop, customZones)) {
      exdates.add(key);
    }
  }

  return {
    uid: unescapeIcs(uid).slice(0, 200),
    ...(summary !== undefined ? { summary: unescapeIcs(summary) } : {}),
    ...(description !== undefined ? { description: unescapeIcs(description) } : {}),
    ...(location !== undefined ? { location: unescapeIcs(location) } : {}),
    classification,
    dtstart,
    dtend,
    ...(rrule ? { rrule } : {}),
    exdates,
  };
}

export type ParseIcsOptions = {
  /** Inclusive range start (UTC ms). Defaults to now - 1 day. */
  rangeStartMs?: number;
  /** Exclusive range end (UTC ms). Defaults to now + 90 days. */
  rangeEndMs?: number;
};

/**
 * Parse an ICS document and expand recurring events into the requested window.
 * Malformed individual VEVENT blocks are skipped; a completely invalid document throws.
 */
export function parseIcs(text: string, options: ParseIcsOptions = {}): ParsedIcsCalendar {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new IcsParseError("ICS document is empty");
  }
  if (!/BEGIN:VCALENDAR/i.test(trimmed)) {
    throw new IcsParseError("ICS document must contain a VCALENDAR component");
  }

  const lines = unfold(trimmed);
  const root = parseComponents(lines);
  const calendars = root.children.filter((child) => child.name === "VCALENDAR");
  if (calendars.length === 0) {
    throw new IcsParseError("ICS document must contain a VCALENDAR component");
  }

  const calendar = calendars[0];
  if (!calendar) {
    throw new IcsParseError("ICS document must contain a VCALENDAR component");
  }
  const customZones = buildTimezoneOffsets(
    calendar.children.filter((child) => child.name === "VTIMEZONE"),
  );
  const calendarName = findProp(calendar, "X-WR-CALNAME")?.value;
  const timezone = findProp(calendar, "X-WR-TIMEZONE")?.value;
  const defaultTzid = timezone && isIanaTimeZone(timezone) ? timezone : undefined;

  const now = Date.now();
  const rangeStartMs = options.rangeStartMs ?? now - 86_400_000;
  const rangeEndMs = options.rangeEndMs ?? now + 90 * 86_400_000;

  const events: ParsedIcsEvent[] = [];
  for (const child of calendar.children) {
    if (child.name !== "VEVENT") {
      continue;
    }
    const master = parseVEvent(child, customZones, defaultTzid);
    if (!master) {
      continue;
    }
    events.push(...expandMaster(master, rangeStartMs, rangeEndMs));
  }

  events.sort((a, b) => a.startsAt.localeCompare(b.startsAt) || a.uid.localeCompare(b.uid));

  return {
    ...(calendarName ? { calendarName: unescapeIcs(calendarName).slice(0, 120) } : {}),
    ...(timezone ? { timezone: timezone.slice(0, 64) } : {}),
    events,
  };
}
