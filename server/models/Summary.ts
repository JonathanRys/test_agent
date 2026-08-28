import { DataTypes, Model, Sequelize } from "sequelize";
import type { ModelStatic } from "sequelize";

interface DBModels {
  Message: ModelStatic<Model>;
}

export class Summary extends Model {
  declare id: number;
  declare userMessageId: number;
  declare assistantMessageId: number;
  declare summary: string;
  declare createdAt: Date;
  static associate(models: DBModels) {
    this.belongsTo(models.Message, { foreignKey: "userMessageId" });
    this.belongsTo(models.Message, { foreignKey: "assistantMessageId" });
  }
}

export function initSummary(sequelize: Sequelize): void {
  Summary.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      userMessageId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      assistantMessageId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      summary: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: "Summary",
      tableName: "summaries",
      timestamps: true,
    },
  );
}
