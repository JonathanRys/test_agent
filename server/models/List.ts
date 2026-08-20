import { DataTypes, Model, Sequelize } from "sequelize";

export class List extends Model {
  declare id: number;
  declare name: string;
  declare state: string;
  declare type: "peakbagging" | "trace";
  declare description: string;
  declare abbreviation: string;
  declare patchAvailable: boolean;
  declare website: string;
  declare phoneNumber: string;
  declare emailAddress: string;
  declare mailingAddress: string;
  declare facebook: string;
  declare instagram: string;
}

export function initList(sequelize: Sequelize): void {
  List.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      name: {
        type: DataTypes.ENUM("peakbagging", "trace"),
        allowNull: false,
      },
      state: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      type: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      abbreviation: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      patchAvailable: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
      },
      website: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      phoneNumber: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      emailAddress: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      mailingAddress: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      facebook: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      instagram: {
        type: DataTypes.STRING,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: "List",
      tableName: "lists",
      timestamps: false,
    },
  );
}
