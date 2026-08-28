import { DataTypes, Model, Sequelize } from "sequelize";
import type { ModelStatic } from "sequelize";

interface DBModels {
  Mountain: ModelStatic<Model>;
  Trail: ModelStatic<Model>;
}

export class State extends Model {
  declare id: number;
  declare name: string;
  declare abbreviation: string;
  static associate(models: DBModels) {
    this.hasMany(models.Mountain, { foreignKey: "stateId" });
    this.hasMany(models.Trail, { foreignKey: "stateId" });
  }
}

export function initState(sequelize: Sequelize): void {
  State.init(
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
      abbreviation: {
        type: DataTypes.STRING,
        allowNull: false,
      },
    },
    {
      sequelize,
      modelName: "State",
      tableName: "states",
      timestamps: false,
    },
  );
}
