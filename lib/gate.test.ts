import { describe, expect, it } from "vitest";
import { averageWeekly, isoWeek, rangeText, weeklyRanges, yearlyEstimate, type Snapshot } from "@/lib/gate";

let n = 0;
const snap = (snapshotDate: string, source: string, plantCsCount: number): Snapshot => ({
  id: String(++n),
  snapshotDate,
  source,
  query: "servicio al cliente planta Monterrey",
  totalCount: plantCsCount + 20,
  plantCsCount,
  notes: null,
});

describe("isoWeek", () => {
  it.each([
    ["2026-10-05", "2026-W41"], // Monday
    ["2026-10-11", "2026-W41"], // Sunday, same week
    ["2026-10-12", "2026-W42"],
    ["2026-01-01", "2026-W01"], // Thursday
    ["2027-01-01", "2026-W53"], // Friday belongs to the last week of 2026
  ])("%s → %s", (date, week) => expect(isoWeek(date)).toBe(week));
});

describe("weekly range", () => {
  it("no snapshots → no numbers (the page says 'Sin datos todavía')", () => {
    expect(weeklyRanges([])).toEqual([]);
    expect(averageWeekly([])).toBeNull();
  });

  it("one week, three sources: low = highest single source, high = sum", () => {
    const week = [snap("2026-10-05", "OCC", 6), snap("2026-10-06", "Indeed", 4), snap("2026-10-07", "LinkedIn", 1)];
    expect(weeklyRanges(week)).toEqual([{ week: "2026-W41", low: 6, high: 11, sources: 3 }]);
    expect(averageWeekly(week)).toEqual({ low: 6, high: 11, weeks: 1 });
  });

  it("a source counted twice in a week uses its latest snapshot (same source, any capitalization)", () => {
    const week = [snap("2026-10-05", "OCC", 6), snap("2026-10-09", "occ ", 8), snap("2026-10-06", "Indeed", 4)];
    expect(weeklyRanges(week)).toEqual([{ week: "2026-W41", low: 8, high: 12, sources: 2 }]);
  });

  it("averages the low and high ends over the weeks, newest week first", () => {
    const data = [
      snap("2026-10-05", "OCC", 6),
      snap("2026-10-06", "Indeed", 4),
      snap("2026-10-12", "OCC", 3),
      snap("2026-10-13", "Indeed", 5),
    ];
    expect(weeklyRanges(data).map((w) => w.week)).toEqual(["2026-W42", "2026-W41"]);
    expect(averageWeekly(data)).toEqual({ low: 5.5, high: 9, weeks: 2 });
  });
});

describe("yearly estimate", () => {
  it("stays pending while the posting lifetime is unknown (owner's decision)", () => {
    expect(yearlyEstimate({ low: 6, high: 11 })).toBeNull();
  });

  it("would use average × 52 ÷ lifetime, as a range, once the lifetime is set", () => {
    expect(yearlyEstimate({ low: 6, high: 11 }, { min: 4, max: 8, source: "test" })).toEqual({ low: 39, high: 143 });
  });
});

describe("rangeText", () => {
  it("formats in es-MX and collapses equal ends", () => {
    expect(rangeText(5.5, 9)).toBe("5.5 a 9");
    expect(rangeText(6, 6)).toBe("6");
    expect(rangeText(1200, 1500)).toBe("1,200 a 1,500");
  });
});
