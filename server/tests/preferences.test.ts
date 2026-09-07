import { describe, expect, it } from "vitest";
import { preferencesSchema } from "../routes/preferences.js";

describe("preference validation", () => {
  it("accepts supported preferences and date-only birthdates", () => {
    const result = preferencesSchema.safeParse({
      fitnessLevel: "intermediate",
      homeLocation: "Somerville, MA",
      units: "imperial",
      interests: ["peakbagging", "trails"],
      publicProfile: false,
      publicRatings: true,
      birthdate: "1990-04-12",
    });

    expect(result.success).toBe(true);
  });

  it("rejects invalid units, dates, and oversized interest lists", () => {
    const result = preferencesSchema.safeParse({
      units: "yards",
      birthdate: "April 12, 1990",
      interests: Array.from({ length: 21 }, () => "trails"),
    });

    expect(result.success).toBe(false);
  });
});
