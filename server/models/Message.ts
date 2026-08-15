import { DataTypes, Model, Sequelize } from "sequelize";

export class Message extends Model {
  declare id: number;
  declare sessionId: string;
  declare message: string;
  declare role: "user" | "assistant";
  declare createdAt: Date;
}

export function initMessage(sequelize: Sequelize): void {
  Message.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      sessionId: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      message: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      role: {
        type: DataTypes.ENUM("user", "assistant"),
        defaultValue: "user",
        allowNull: false,
      },
    },
    {
      sequelize,
      modelName: "Message",
      tableName: "messages",
      timestamps: true,
    },
  );
}
