import { DataTypes, Sequelize } from "sequelize";
import path from "path";
import { fileURLToPath } from "url";
import { Activity, initializeModels } from "../models/index.js";

import activities from "../data/activities.json" with { type: "json" };

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, "../../data/memory.db");

// Initialize Sequelize
export const sequelize = new Sequelize({
  dialect: "sqlite",
  storage: dbPath,
  logging: false, // Set to console.log for debugging
});

// Initialize models
initializeModels(sequelize);

// Track initialization state
let isInitialized = false;

// Initialize database
export async function ensureInitialized(): Promise<void> {
  if (isInitialized) return;

  try {
    await sequelize.sync();
    const userColumns = await sequelize
      .getQueryInterface()
      .describeTable("users");
    if (!userColumns.passwordHash) {
      await sequelize.getQueryInterface().addColumn("users", "passwordHash", {
        type: DataTypes.STRING,
        allowNull: true,
      });
    }
    if (!userColumns.emailVerifiedAt) {
      await sequelize
        .getQueryInterface()
        .addColumn("users", "emailVerifiedAt", {
          type: DataTypes.DATE,
          allowNull: true,
        });
    }
    const queryInterface = sequelize.getQueryInterface();
    const preferenceColumns =
      await queryInterface.describeTable("userPreferences");
    if (!preferenceColumns.birthdate) {
      await queryInterface.addColumn("userPreferences", "birthdate", {
        type: DataTypes.DATEONLY,
        allowNull: true,
      });
    }
    const legacyPreferenceColumns = [
      "birthdate",
      "fitnessLevel",
      "homeLocation",
    ].filter((column) => userColumns[column]);
    if (legacyPreferenceColumns.length > 0) {
      await sequelize.query(`
        INSERT OR IGNORE INTO "userPreferences"
          ("userId", "birthdate", "fitnessLevel", "homeLocation", "createdAt", "updatedAt")
        SELECT "id", "birthdate", "fitnessLevel", "homeLocation", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        FROM "users";
      `);
      await sequelize.query(`
        UPDATE "userPreferences"
        SET "birthdate" = COALESCE("birthdate", (SELECT "birthdate" FROM "users" WHERE "users"."id" = "userPreferences"."userId")),
            "fitnessLevel" = COALESCE("fitnessLevel", (SELECT "fitnessLevel" FROM "users" WHERE "users"."id" = "userPreferences"."userId")),
            "homeLocation" = COALESCE("homeLocation", (SELECT "homeLocation" FROM "users" WHERE "users"."id" = "userPreferences"."userId"));
      `);
    }
    const activityCount = await Activity.count();
    if (activityCount === 0) {
      const activityRows = (
        activities as Array<{ name: string; parentActivity?: number }>
      ).filter((row) => row.name !== "Empty");
      await Activity.bulkCreate(activityRows);
    }
    isInitialized = true;
  } catch (error) {
    console.error("Failed to sync database:", error);
    throw error;
  }
}
