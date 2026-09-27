import { DataTypes, Model, Sequelize } from "sequelize";
import type { ModelStatic } from "sequelize";

interface DBModels {
  State: ModelStatic<Model>;
  UsdaRegion: ModelStatic<Model>;
  [key: string]: ModelStatic<Model>;
}

export class UsdaPark extends Model {
  declare id: number;
  declare stateId: number;
  declare regionId: number;
  declare link: string;
  declare name: string;
  static associate(models: DBModels) {
    this.belongsTo(models.State, { foreignKey: "stateId" });
    this.belongsTo(models.UsdaRegion, { foreignKey: "regionId" });
  }
}

export function initUsdaPark(sequelize: Sequelize): void {
  UsdaPark.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      stateId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      regionId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      link: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
    },
    {
      sequelize,
      modelName: "UsdaPark",
      tableName: "usdaParks",
      timestamps: false,
    },
  );
}
