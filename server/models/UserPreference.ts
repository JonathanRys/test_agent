import { DataTypes, Model, Sequelize } from "sequelize";
import type { ModelStatic } from "sequelize";

interface DBModels {
  User: ModelStatic<Model>;
}

export class UserPreference extends Model {
  declare id: number;
  declare userId: number;
  declare fitnessLevel: "beginner" | "intermediate" | "expert" | null;
  declare homeLocation: string | null;
  declare units: "imperial" | "metric";
  declare interests: string[];
  declare publicProfile: boolean;
  declare publicRatings: boolean;
}

export function initUserPreference(sequelize: Sequelize): void {
  UserPreference.init(
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      userId: { type: DataTypes.INTEGER, allowNull: false, unique: true },
      fitnessLevel: { type: DataTypes.STRING, allowNull: true },
      homeLocation: { type: DataTypes.STRING, allowNull: true },
      units: {
        type: DataTypes.ENUM("imperial", "metric"),
        allowNull: false,
        defaultValue: "imperial",
      },
      interests: { type: DataTypes.JSON, allowNull: false, defaultValue: [] },
      publicProfile: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      publicRatings: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
    },
    {
      sequelize,
      modelName: "UserPreference",
      tableName: "userPreferences",
      timestamps: true,
    },
  );
}
