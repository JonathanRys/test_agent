import { DataTypes, Model, Sequelize } from "sequelize";

export class MountainList extends Model {
  declare id: number;
  declare mountainId: number;
  declare listId: number;
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
