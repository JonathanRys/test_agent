import { DataTypes, Model, Sequelize } from "sequelize";

export class State extends Model {
  declare id: number;
  declare name: string;
  declare abbreviation: string;
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
