import { XMLParser } from "fast-xml-parser";
import { Router } from "express";
import { z } from "zod";
import { requireAdmin } from "../middleware/auth.js";
import { AuthSession, EmailVerificationToken, State, Trail, User } from "../models/index.js";
import { ensureInitialized } from "../utils/db.js";
import { sendVerificationEmail } from "../services/emailVerification.js";

export const adminRouter = Router();
export const gpxUploadQuerySchema = z.object({
  name: z.string().trim().min(1).max(150),
  description: z.string().trim().max(5000).optional(),
  stateId: z.coerce.number().int().positive(),
});
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  parseTagValue: false,
});

type GpxPoint = [number, number, number?];

function asArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

export function parseGpx(xml: string) {
  const root = parser.parse(xml)?.gpx;
  if (!root || typeof root !== "object") throw new Error("Invalid GPX file");

  const tracks = asArray<any>(root.trk);
  const routes = asArray<any>(root.rte);
  const segments = tracks.flatMap((track) => asArray<any>(track.trkseg));
  const rawPoints = [
    ...segments.flatMap((segment) => asArray<any>(segment.trkpt)),
    ...routes.flatMap((route) => asArray<any>(route.rtept)),
  ];
  const coordinates: GpxPoint[] = rawPoints.map((point) => {
    const lon = Number(point?.lon);
    const lat = Number(point?.lat);
    const elevation = Number(point?.ele);
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) {
      throw new Error("GPX contains an invalid coordinate");
    }
    return Number.isFinite(elevation)
      ? [lon, lat, elevation]
      : [lon, lat];
  });
  if (coordinates.length < 2) {
    throw new Error("GPX must contain at least two track or route points");
  }

  const title =
    asArray<any>(root.trk)[0]?.name ??
    asArray<any>(root.rte)[0]?.name ??
    root.metadata?.name;
  let meters = 0;
  let gainMeters = 0;
  let lossMeters = 0;
  for (let index = 1; index < coordinates.length; index += 1) {
    const [lon1, lat1, ele1] = coordinates[index - 1];
    const [lon2, lat2, ele2] = coordinates[index];
    const radians = Math.PI / 180;
    const latitudeDelta = (lat2 - lat1) * radians;
    const longitudeDelta = (lon2 - lon1) * radians;
    const haversine =
      Math.sin(latitudeDelta / 2) ** 2 +
      Math.cos(lat1 * radians) *
        Math.cos(lat2 * radians) *
        Math.sin(longitudeDelta / 2) ** 2;
    meters += 6_371_000 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
    if (ele1 !== undefined && ele2 !== undefined) {
      const change = ele2 - ele1;
      if (change > 0) gainMeters += change;
      else lossMeters -= change;
    }
  }

  return {
    title: typeof title === "string" ? title.trim() : "",
    coordinates,
    distance: meters / 1609.344,
    elevationGain: gainMeters * 3.28084,
    elevationLoss: lossMeters * 3.28084,
  };
}

adminRouter.get("/admin/users", requireAdmin, async (_req, res, next) => {
  try {
    await ensureInitialized();
    const users = await User.findAll({
      attributes: ["id", "name", "email", "emailVerifiedAt", "isPaid", "accessDenied", "createdAt"],
      order: [["createdAt", "DESC"]],
    });
    res.json({ ok: true, users });
  } catch (error) {
    next(error);
  }
});

adminRouter.patch("/admin/users/:id", requireAdmin, async (req, res, next) => {
  try {
    const id = z.coerce.number().int().positive().parse(req.params.id);
    const patch = z
      .object({
        name: z.string().trim().min(1).max(100).optional(),
        email: z.string().trim().email().max(254).optional(),
        isPaid: z.boolean().optional(),
        accessDenied: z.boolean().optional(),
      })
      .strict()
      .refine((value) => Object.keys(value).length > 0)
      .parse(req.body);
    await ensureInitialized();
    const user = await User.findByPk(id);
    if (!user) {
      res.status(404).json({ ok: false, error: "User not found" });
      return;
    }
    const emailChanged = patch.email !== undefined && patch.email.toLowerCase() !== user.email;
    if (patch.email) {
      patch.email = patch.email.toLowerCase();
      const duplicate = await User.findOne({ where: { email: patch.email } });
      if (duplicate && duplicate.id !== user.id) {
        res.status(409).json({ ok: false, error: "Email is already in use" });
        return;
      }
    }
    if (patch.accessDenied && user.id === req.user!.id) {
      res.status(400).json({ ok: false, error: "You cannot deny your own access" });
      return;
    }
    const wasDenied = user.accessDenied;
    await user.update(patch);
    if (emailChanged) {
      user.emailVerifiedAt = null;
      await user.save();
      await EmailVerificationToken.update(
        { consumedAt: new Date() },
        { where: { userId: user.id, consumedAt: null } },
      );
    }
    if (!wasDenied && user.accessDenied) {
      await AuthSession.update(
        { revokedAt: new Date() },
        { where: { userId: user.id, revokedAt: null } },
      );
    }
    res.json({ ok: true, user });
  } catch (error) {
    next(error);
  }
});

adminRouter.post(
  "/admin/users/:id/resend-verification",
  requireAdmin,
  async (req, res, next) => {
    try {
      const id = z.coerce.number().int().positive().parse(req.params.id);
      await ensureInitialized();
      const user = await User.findByPk(id);
      if (!user) {
        res.status(404).json({ ok: false, error: "User not found" });
        return;
      }
      await sendVerificationEmail(user);
      res.json({ ok: true });
    } catch (error) {
      if (error instanceof Error && error.message === "EMAIL_ALREADY_VERIFIED") {
        res.status(409).json({ ok: false, error: "This email is already verified" });
        return;
      }
      if (error instanceof Error && error.message === "EMAIL_DELIVERY_NOT_CONFIGURED") {
        res.status(503).json({ ok: false, error: "Configure SMTP settings to send email" });
        return;
      }
      if (error instanceof Error) {
        console.error("Verification email delivery failed:", error);
        res.status(502).json({ ok: false, error: "Unable to send verification email" });
        return;
      }
      next(error);
    }
  },
);

adminRouter.get("/admin/states", requireAdmin, async (_req, res, next) => {
  try {
    await ensureInitialized();
    const states = await State.findAll({
      attributes: ["id", "name", "abbreviation"],
      order: [["name", "ASC"]],
    });
    res.json({ ok: true, states });
  } catch (error) {
    next(error);
  }
});

adminRouter.post("/admin/trails/gpx", requireAdmin, async (req, res, next) => {
  try {
    const body = gpxUploadQuerySchema.parse(req.query);
    const xml = typeof req.body === "string" ? req.body : "";
    if (!xml || !/<gpx[\s>]/i.test(xml)) {
      res.status(400).json({ ok: false, error: "Upload a valid GPX file" });
      return;
    }

    await ensureInitialized();
    const state = await State.findByPk(body.stateId);
    if (!state) {
      res.status(400).json({ ok: false, error: "Choose a valid state" });
      return;
    }
    const parsed = parseGpx(xml);
    const name = body.name;
    const [startLon, startLat] = parsed.coordinates[0];
    const [endLon, endLat] = parsed.coordinates.at(-1)!;
    const trail = await Trail.create({
      name,
      description: body.description?.trim() || null,
      required: false,
      stateId: state.id,
      distance: parsed.distance,
      elevationGain: parsed.elevationGain,
      elevationLoss: parsed.elevationLoss,
      startLat,
      startLon,
      endLat,
      endLon,
      gpx: {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            properties: { name },
            geometry: { type: "LineString", coordinates: parsed.coordinates },
          },
        ],
      },
    });
    res.status(201).json({ ok: true, trail });
  } catch (error) {
    if (error instanceof Error && /GPX/.test(error.message)) {
      res.status(400).json({ ok: false, error: error.message });
      return;
    }
    next(error);
  }
});