import { User, UserPreference } from "../models/index.js";
import { ensureInitialized } from "../utils/db.js";

export type UserProfile = {
  id: number;
  name: string;
  email: string;
  preferences: {
    birthdate: string | null;
    fitnessLevel: "beginner" | "intermediate" | "expert" | null;
    homeLocation: string | null;
    units: "imperial" | "metric";
    interests: string[];
  };
};

export async function getUserProfile(
  userId: number,
): Promise<UserProfile | null> {
  await ensureInitialized();

  const [user, preferences] = await Promise.all([
    User.findByPk(userId, {
      attributes: ["id", "name", "email"],
    }),
    UserPreference.findOrCreate({
      where: { userId },
      defaults: { userId },
    }).then(([record]) => record),
  ]);

  if (!user) return null;

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    preferences: {
      birthdate: preferences.birthdate,
      fitnessLevel: preferences.fitnessLevel,
      homeLocation: preferences.homeLocation,
      units: preferences.units,
      interests: preferences.interests,
    },
  };
}
