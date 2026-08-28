import { DataTypes, Model, Sequelize } from "sequelize";
import type { ModelStatic } from "sequelize";

interface DBModels {
  User: ModelStatic<Model>;
  Activity: ModelStatic<Model>;
  TrailCompletion: ModelStatic<Model>;
  Summit: ModelStatic<Model>;
}

export class Adventure extends Model {
  declare id: number;
  declare name: string;
  declare userId: number;
  declare activityId: number | null;
  declare activityDate: Date;
  declare activityTrack: unknown | null;
  declare createdAt: Date;
  declare updatedAt: Date;
  declare deletedAt: Date | null;
  static associate(models: DBModels) {
    this.belongsTo(models.User, { foreignKey: "userId" });
    this.belongsTo(models.Activity, { foreignKey: "activityId" });
    this.hasMany(models.TrailCompletion, { foreignKey: "adventureId" });
    this.hasMany(models.Summit, { foreignKey: "adventureId" });
  }
}

export function initAdventure(sequelize: Sequelize): void {
  Adventure.init(
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
      userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      activityId: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      activityDate: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      activityTrack: {
        type: DataTypes.JSON,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: "Adventure",
      tableName: "adventures",
      timestamps: true,
      paranoid: true,
    },
  );
}
