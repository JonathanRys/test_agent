import { DataTypes, Model, Sequelize } from "sequelize";
import type { ModelStatic } from "sequelize";

interface DBModels {
  Trail: ModelStatic<Model>;
  List: ModelStatic<Model>;
}

export class TrailList extends Model {
  declare id: number;
  declare trailId: number;
  declare listId: number;
  static associate(models: DBModels) {
    this.belongsTo(models.Trail, { foreignKey: "trailId" });
    this.belongsTo(models.List, { foreignKey: "listId" });
  }
}

export function initTrailList(sequelize: Sequelize): void {
  TrailList.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      trailId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      listId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
    },
    {
      sequelize,
      modelName: "TrailList",
      tableName: "TrailLists",
      timestamps: false,
    },
  );
}
