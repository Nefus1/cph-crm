import { describe, expect, it } from "vitest";
import en from "../messages/en.json";
import es from "../messages/es.json";
import { PRACTICE_AREA_CONFIG, PRACTICE_AREAS, stagesFor } from "@/config/practice-areas";

function flatten(obj: Record<string, unknown>, prefix = ""): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v && typeof v === "object") Object.assign(out, flatten(v as Record<string, unknown>, `${prefix}${k}.`));
    else out[`${prefix}${k}`] = String(v);
  }
  return out;
}

const placeholders = (s: string) => [...new Set([...s.matchAll(/\{(\w+)(?=[,}])/g)].map((m) => m[1]))].sort();

describe("translations", () => {
  const fe = flatten(en);
  const fs = flatten(es);
  it("Spanish has exactly the same keys as English", () => {
    expect(Object.keys(fs).sort()).toEqual(Object.keys(fe).sort());
  });
  it("placeholders match in every string", () => {
    for (const k of Object.keys(fe)) expect(placeholders(fs[k] ?? ""), k).toEqual(placeholders(fe[k]));
  });
  it("no Spanish string is left empty unless English is empty", () => {
    for (const k of Object.keys(fe)) if (fe[k]) expect(fs[k], k).not.toBe("");
  });
});

describe("practice-area config", () => {
  it.each(PRACTICE_AREAS)("%s is complete and bilingual", (area) => {
    const cfg = PRACTICE_AREA_CONFIG[area];
    expect(cfg.types.length).toBeGreaterThan(0);
    expect(cfg.sides.length).toBeGreaterThan(0);
    expect(cfg.checklist.length).toBeGreaterThan(0);
    for (const side of cfg.sides) {
      const stages = stagesFor(area, side.value);
      expect(stages.length).toBeGreaterThan(1);
      expect(new Set(stages.map((s) => s.key)).size).toBe(stages.length);
    }
    const labels = [cfg.label, ...cfg.types.map((t) => t.label), ...cfg.sides.map((s) => s.label), ...cfg.checklist, ...cfg.fields.map((f) => f.label), ...Object.values(cfg.stages).flat().map((s) => s.label)];
    for (const l of labels) {
      expect(l.en.length).toBeGreaterThan(0);
      expect(l.es.length).toBeGreaterThan(0);
    }
  });
});
