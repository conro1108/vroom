import { describe, expect, it } from "vitest";
import { activeStyleId, applyStyle, DRIVING_STYLES } from "./styles";
import { DEFAULT_TUNING, type Tuning } from "./tuning";

describe("driving styles", () => {
  it("has 6 uniquely named styles", () => {
    expect(DRIVING_STYLES).toHaveLength(6);
    expect(new Set(DRIVING_STYLES.map((s) => s.id)).size).toBe(6);
  });

  it("Classic matches the shipped defaults, so fresh installs show it active", () => {
    expect(activeStyleId({ ...DEFAULT_TUNING })).toBe("classic");
  });

  it("applying any style makes it the active one", () => {
    for (const style of DRIVING_STYLES) {
      const tuning: Tuning = { ...DEFAULT_TUNING };
      applyStyle(tuning, style);
      expect(activeStyleId(tuning)).toBe(style.id);
    }
  });

  it("a manual tweak on top of a style deactivates it", () => {
    const tuning: Tuning = { ...DEFAULT_TUNING };
    applyStyle(tuning, DRIVING_STYLES[1]!);
    tuning.turnRate += 0.1;
    expect(activeStyleId(tuning)).toBeNull();
  });

  it("styles leave control and camera preferences untouched", () => {
    const tuning: Tuning = { ...DEFAULT_TUNING, steerMode: "dragx", holdToGo: false, cameraLerp: 9 };
    for (const style of DRIVING_STYLES) applyStyle(tuning, style);
    expect(tuning.steerMode).toBe("dragx");
    expect(tuning.holdToGo).toBe(false);
    expect(tuning.cameraLerp).toBe(9);
  });
});
