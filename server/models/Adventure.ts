import { DataTypes, Model, Sequelize } from "sequelize";

export class Adventure extends Model {
  declare id: number;
  declare name: string;
  declare activityId: number | null;
  declare activityDate: Date;
  declare activityTrack: unknown | null;
  declare createdAt: Date;
  declare updatedAt: Date;
  declare deletedAt: Date | null;
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
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      activityDate: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      activityTrack: {
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
