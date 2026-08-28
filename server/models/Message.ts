import { DataTypes, Model, Sequelize } from "sequelize";
import type { ModelStatic } from "sequelize";

interface DBModels {
  Session: ModelStatic<Model>;
  Summary: ModelStatic<Model>;
}

export class Message extends Model {
  declare id: number;
  declare sessionId: string;
  declare message: string;
  declare role: "user" | "assistant";
  declare createdAt: Date;
  static associate(models: DBModels) {
    this.belongsTo(models.Session, { foreignKey: "sessionId" });
    this.hasMany(models.Summary, { foreignKey: "userMessageId" });
    this.hasMany(models.Summary, { foreignKey: "assistantMessageId" });
  }
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
