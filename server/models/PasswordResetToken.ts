import { DataTypes, Model, Sequelize } from "sequelize";
import type { ModelStatic } from "sequelize";

interface DBModels {
  User: ModelStatic<Model>;
}

export class PasswordResetToken extends Model {
  declare id: number;
  declare userId: number;
  declare tokenHash: string;
  declare expiresAt: Date;
  declare consumedAt: Date | null;
  declare createdAt: Date;
  declare updatedAt: Date;
  static associate(models: DBModels) {
    this.belongsTo(models.User, { foreignKey: "userId" });
  }
}

export function initPasswordResetToken(sequelize: Sequelize): void {
  PasswordResetToken.init(
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      userId: { type: DataTypes.INTEGER, allowNull: false },
      tokenHash: { type: DataTypes.STRING(64), allowNull: false, unique: true },
      expiresAt: { type: DataTypes.DATE, allowNull: false },
      consumedAt: { type: DataTypes.DATE, allowNull: true },
    },
    {
      sequelize,
      modelName: "PasswordResetToken",
      tableName: "passwordResetTokens",
      timestamps: true,
    },
  );
}
