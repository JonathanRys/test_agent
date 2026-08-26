import { DataTypes, Model, Sequelize } from "sequelize";

export class Activity extends Model {
  declare id: number;
  declare name: string;
  declare parentActivity: number | null;
}

export function initActivity(sequelize: Sequelize): void {
  Activity.init(
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
      parentActivity: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: "Activity",
      tableName: "activities",
      timestamps: false,
    },
  );
}
