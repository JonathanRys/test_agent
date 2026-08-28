import { DataTypes, Model, Sequelize } from "sequelize";
import type { ModelStatic } from "sequelize";

interface DBModels {
  Mountain: ModelStatic<Model>;
  List: ModelStatic<Model>;
}

export class MountainList extends Model {
  declare id: number;
  declare mountainId: number;
  declare listId: number;
  static associate(models: DBModels) {
    this.belongsTo(models.Mountain, { foreignKey: "mountainId" });
    this.belongsTo(models.List, { foreignKey: "listId" });
  }
}

export function initMountainList(sequelize: Sequelize): void {
  MountainList.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      mountainId: {
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
      modelName: "MountainList",
      tableName: "mountainLists",
      timestamps: false,
    },
  );
}
