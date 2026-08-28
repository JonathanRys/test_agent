import { DataTypes, Model, Sequelize } from "sequelize";
import type { ModelStatic } from "sequelize";

interface DBModels {
  User: ModelStatic<Model>;
  Message: ModelStatic<Model>;
}

export class Session extends Model {
  declare id: string;
  declare userId: number;
  declare memoryType: "short-term" | "long-term";
  declare createdAt: Date;
  declare updatedAt: Date;
  static associate(models: DBModels) {
    this.belongsTo(models.User, { foreignKey: "userId" });
    this.hasMany(models.Message, { foreignKey: "sessionId" });
  }
}

export function initSession(sequelize: Sequelize): void {
  Session.init(
    {
      id: {
        type: DataTypes.STRING,
        primaryKey: true,
      },
      userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
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
