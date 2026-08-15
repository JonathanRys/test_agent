import { DataTypes, Model, Sequelize } from "sequelize";

export class Session extends Model {
  declare id: string;
  declare memoryType: "short-term" | "long-term";
  declare createdAt: Date;
  declare updatedAt: Date;
}

export function initSession(sequelize: Sequelize): void {
  Session.init(
    {
      id: {
        type: DataTypes.STRING,
        primaryKey: true,
      },
      memoryType: {
        type: DataTypes.ENUM("short-term", "long-term"),
        defaultValue: "short-term",
        allowNull: false,
      },
    },
    {
      sequelize,
      modelName: "Session",
      tableName: "sessions",
      timestamps: true,
    },
  );
}
