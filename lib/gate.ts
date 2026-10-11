// Gate 1 (packet §11.2): aggregate counts of plant customer-service openings
// in Monterrey. Numbers only: no postings, companies or people. Pure functions.

export type Snapshot = {
  id: string;
  snapshotDate: string; // YYYY-MM-DD
  source: string;
  query: string;
  totalCount: number;
  plantCsCount: number;
  notes: string | null;
};

// Typical number of weeks a posting stays up, needed for the yearly estimate.
// Deliberately unset: the owner won't invent it. Set { min, max, source } when known.
export const POSTING_LIFETIME_WEEKS: { min: number; max: number; source: string } | null = null;

// ISO week ("2026-W41") of a calendar date, computed in UTC so it never shifts.
export function isoWeek(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const day = new Date(Date.UTC(y, m - 1, d));
  const weekday = day.getUTCDay() || 7; // Monday = 1 … Sunday = 7
  day.setUTCDate(day.getUTCDate() + 4 - weekday); // Thursday of this week
  const yearStart = new Date(Date.UTC(day.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((day.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${day.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export type WeekRange = { week: string; low: number; high: number; sources: number };

// Per week: low = the highest single source (no double counting), high = the sum
// across sources (the same posting may appear on several sites). If a source has
// more than one snapshot in a week, its latest one counts.
export function weeklyRanges(snapshots: Snapshot[]): WeekRange[] {
  const latest = new Map<string, Snapshot>(); // key: week + source
  for (const s of snapshots) {
    const key = `${isoWeek(s.snapshotDate)}|${s.source.trim().toLowerCase()}`;
    const current = latest.get(key);
    if (!current || s.snapshotDate > current.snapshotDate) latest.set(key, s);
  }
  const byWeek = new Map<string, number[]>();
  for (const s of latest.values()) {
    const week = isoWeek(s.snapshotDate);
    byWeek.set(week, [...(byWeek.get(week) ?? []), s.plantCsCount]);
  }
  return [...byWeek.entries()]
    .map(([week, counts]) => ({
      week,
      low: Math.max(...counts),
      high: counts.reduce((sum, n) => sum + n, 0),
      sources: counts.length,
    }))
    .sort((a, b) => b.week.localeCompare(a.week));
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export function averageWeekly(snapshots: Snapshot[]): { low: number; high: number; weeks: number } | null {
  const weeks = weeklyRanges(snapshots);
  if (weeks.length === 0) return null;
  const avg = (pick: (w: WeekRange) => number) => round1(weeks.reduce((sum, w) => sum + pick(w), 0) / weeks.length);
  return { low: avg((w) => w.low), high: avg((w) => w.high), weeks: weeks.length };
}

// Openings per year ≈ average weekly count × 52 ÷ weeks a posting stays up.
// null while the posting lifetime is unknown: the page then says "pendiente".
export function yearlyEstimate(
  average: { low: number; high: number } | null,
  lifetime = POSTING_LIFETIME_WEEKS,
): { low: number; high: number } | null {
  if (!average || !lifetime) return null;
  return { low: Math.round((average.low * 52) / lifetime.max), high: Math.round((average.high * 52) / lifetime.min) };
}

export function rangeText(low: number, high: number): string {
  const fmt = (n: number) => n.toLocaleString("es-MX", { maximumFractionDigits: 1 });
  return low === high ? fmt(low) : `${fmt(low)} a ${fmt(high)}`;
}
