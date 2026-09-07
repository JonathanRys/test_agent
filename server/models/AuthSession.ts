import { DataTypes, Model, Sequelize } from "sequelize";
import type { ModelStatic } from "sequelize";

interface DBModels {
  User: ModelStatic<Model>;
}

export class AuthSession extends Model {
  declare id: number;
  declare userId: number;
  declare accessTokenHash: string;
  declare refreshTokenHash: string;
  declare accessExpiresAt: Date;
  declare refreshExpiresAt: Date;
  declare revokedAt: Date | null;
  declare createdAt: Date;
  declare updatedAt: Date;

  static associate(models: DBModels) {
    this.belongsTo(models.User, { foreignKey: "userId" });
  }
}

export function initAuthSession(sequelize: Sequelize): void {
  AuthSession.init(
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      userId: { type: DataTypes.INTEGER, allowNull: false },
      accessTokenHash: {
        type: DataTypes.STRING(64),
        allowNull: false,
        unique: true,
      },
      refreshTokenHash: {
        type: DataTypes.STRING(64),
        allowNull: false,
        unique: true,
      },
      accessExpiresAt: { type: DataTypes.DATE, allowNull: false },
      refreshExpiresAt: { type: DataTypes.DATE, allowNull: false },
      revokedAt: { type: DataTypes.DATE, allowNull: true },
    },
    {
      sequelize,
      modelName: "AuthSession",
      tableName: "authSessions",
      timestamps: true,
    },
  );
}
