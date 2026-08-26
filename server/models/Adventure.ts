import { DataTypes, Model, Sequelize } from "sequelize";

export class Adventure extends Model {
  declare id: number;
  declare name: string;
  declare activityType: number;
  declare activityDate: Date;
  declare createdAt: Date;
  declare updatedAt: Date;
  declare deletedAt: Date;
}

export function initAdventure(sequelize: Sequelize): void {
  Adventure.init(
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
      activityId: {
        // Maybe make a summits table and a trails table to track list progress
        // This is the activity type, possibly belongs in a different table with activityTrack
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      activityDate: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      activityTrack: {
        // maybe make this it's own table
        type: DataTypes.JSON,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: "Adventure",
      tableName: "adventures",
      timestamps: true,
      paranoid: true,
    },
  );
}
