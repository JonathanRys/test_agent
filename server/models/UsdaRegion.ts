import { DataTypes, Model, Sequelize } from "sequelize";
import type { ModelStatic } from "sequelize";

interface DBModels {
  State: ModelStatic<Model>;
  UsdaRegion: ModelStatic<Model>;
  UsdaPark: ModelStatic<Model>;
  [key: string]: ModelStatic<Model>;
}

export class UsdaRegion extends Model {
  declare id: number;
  declare regionCode: string;
  declare name: string;
  static associate(models: DBModels) {
    this.hasMany(models.UsdaPark, { foreignKey: "regionId" });
  }
}

export function initUsdaRegion(sequelize: Sequelize): void {
  UsdaRegion.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      regionCode: {
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
      modelName: "UsdaRegion",
      tableName: "usdaRegions",
      timestamps: false,
    },
  );
}
