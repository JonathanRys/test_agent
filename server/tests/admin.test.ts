import { describe, expect, it } from "vitest";
import { gpxUploadQuerySchema, parseGpx } from "../routes/admin.js";

describe("GPX parsing", () => {
  it("requires a nonblank name for uploaded trails", () => {
    expect(() => gpxUploadQuerySchema.parse({ stateId: "1" })).toThrow();
    expect(() => gpxUploadQuerySchema.parse({ name: "   ", stateId: "1" })).toThrow();
    expect(gpxUploadQuerySchema.parse({ name: " Creek Loop ", stateId: "1" })).toMatchObject({
      name: "Creek Loop",
      stateId: 1,
    });
  });

  it("converts trackpoints into a GeoJSON-ready line and trail metrics", () => {
    const parsed = parseGpx(`<?xml version="1.0"?>
      <gpx version="1.1" creator="test">
        <trk><name>Creek Loop</name><trkseg>
          <trkpt lat="40" lon="-105"><ele>100</ele></trkpt>
          <trkpt lat="40.001" lon="-105"><ele>110</ele></trkpt>
        </trkseg></trk>
      </gpx>`);

    expect(parsed.title).toBe("Creek Loop");
    expect(parsed.coordinates).toEqual([
      [-105, 40, 100],
      [-105, 40.001, 110],
    ]);
    expect(parsed.distance).toBeGreaterThan(0.06);
    expect(parsed.elevationGain).toBeCloseTo(32.8084);
    expect(parsed.elevationLoss).toBe(0);
  });

  it("requires at least two valid points", () => {
    expect(() => parseGpx("<gpx><trk><trkseg><trkpt lat='40' lon='-105'/></trkseg></trk></gpx>"))
      .toThrow("GPX must contain at least two track or route points");
  });
});