import { DataTypes, Model, Sequelize } from "sequelize";

export class TrailList extends Model {
  declare id: number;
  declare trailId: number;
  declare listId: number;
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
