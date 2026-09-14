import { describe, expect, it } from "vitest";
import {
  calculateAMCRating,
  getStubMountainDifficulty,
  getStubTrailDifficulty,
} from "../utils/amcRating.js";

describe("AMC trail difficulty", () => {
  it("calculates the expected rating from trail metrics", () => {
    expect(
      calculateAMCRating({
        durationHours: 3.5,
        mileage: 5,
        elevationGainFt: 800,
        isYouthOrFamily: false,
      }),
    ).toBe("Easy");
  });

  it("provides temporary hard-coded trail ratings", () => {
    expect(getStubTrailDifficulty(1)).toMatchObject({
      trailId: 1,
      rating: "Easy",
    });
    expect(getStubTrailDifficulty(999)).toBeNull();
  });

  it("returns the low-to-high range for a stub mountain", () => {
    expect(getStubMountainDifficulty(2)).toMatchObject({
      mountainId: 2,
      low: "Moderate",
      high: "Strenuous",
    });
  });
});
