import { DataTypes, Model, Sequelize } from "sequelize";
import type { ModelStatic } from "sequelize";

interface DBModels {
  User: ModelStatic<Model>;
  Session: ModelStatic<Model>;
  Adventure: ModelStatic<Model>;
  Summit: ModelStatic<Model>;
  TrailCompletion: ModelStatic<Model>;
  [key: string]: ModelStatic<Model>; // Fallback index signature
}

export class User extends Model {
  declare id: number;
  declare name: string;
  declare email: string;
  declare password: string;
  declare fitnessLevel: "beginner" | "intermediate" | "expert";
  declare homeLocation: string; // needed in case location is disabled
  declare createdAt: Date;
  declare updatedAt: Date;
  declare deletedAt: Date;
  static associate(models: DBModels) {
    this.hasMany(models.Session, { foreignKey: "userId" });
    this.hasMany(models.Adventure, { foreignKey: "userId" });
    this.hasMany(models.Summit, { foreignKey: "userId" });
    this.hasMany(models.TrailCompletion, { foreignKey: "userId" });
  }
}

export function initUser(sequelize: Sequelize): void {
  User.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      email: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      password: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      fitnessLevel: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      homeLocation: {
        type: DataTypes.STRING,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: "User",
      tableName: "users",
      timestamps: true,
      paranoid: true,
    },
  );
}
