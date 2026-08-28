import { DataTypes, Model, Sequelize } from "sequelize";
import type { ModelStatic } from "sequelize";

interface DBModels {
  Season: ModelStatic<Model>;
}

export class SeasonDate extends Model {
  declare id: number;
  declare seasonId: number;
  declare startDate: Date;
  declare endDate: Date;
  static associate(models: DBModels) {
    this.belongsTo(models.Season, { foreignKey: "seasonId" });
  }
}

export function initSeasonDate(sequelize: Sequelize): void {
  SeasonDate.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      seasonId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      startDate: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      endDate: {
        type: DataTypes.STRING,
        allowNull: false,
      },
    },
    {
      sequelize,
      modelName: "SeasonDate",
      tableName: "seasonDates",
      timestamps: false,
    },
  );
}
