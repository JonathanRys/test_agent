import { DataTypes, Model, Sequelize } from "sequelize";
import type { ModelStatic } from "sequelize";

interface DBModels {
  SeasonDate: ModelStatic<Model>;
}

export class Season extends Model {
  declare id: number;
  declare name: number;
  static associate(models: DBModels) {
    this.hasMany(models.SeasonDate, { foreignKey: "seasonId" });
  }
}

export function initSeason(sequelize: Sequelize): void {
  Season.init(
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
    },
    {
      sequelize,
      modelName: "Season",
      tableName: "seasons",
      timestamps: false,
    },
  );
}
