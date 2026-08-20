import { DataTypes, Model, Sequelize } from "sequelize";

export class Mountain extends Model {
  declare id: number;
  declare name: string;
  declare height: number;
  declare prominence: number;
  declare distance: number;
  declare state: string;
  declare range: string;
  declare bushwhack: boolean;
  declare notes: string;
  declare lat: number;
  declare lon: number;
}

export function initMountain(sequelize: Sequelize): void {
  Mountain.init(
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
      height: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      prominence: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      distance: {
        type: DataTypes.FLOAT,
        allowNull: true,
      },
      state: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      range: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      bushwhack: {
        type: DataTypes.BOOLEAN,
        allowNull: true,
      },
      notes: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      lat: {
        type: DataTypes.FLOAT,
        allowNull: true,
      },
      lon: {
        type: DataTypes.FLOAT,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: "Mountain",
      tableName: "mountains",
      timestamps: false,
    },
  );
}
