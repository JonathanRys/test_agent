import { DataTypes, Model, Sequelize } from "sequelize";

export class User extends Model {
  declare id: number;
  declare name: string;
  declare email: string;
  declare password: string;
  declare fitnessLevel: "beginner" | "intermediate" | "expert";
  declare homeLocation: string; // needed in case location is disabled
  declare createdAt: Date;
  declare updatedAt: Date;
  declare deletedAt: Date;
}

export function initUser(sequelize: Sequelize): void {
  User.init(
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
      email: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      password: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      fitnessLevel: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      homeLocation: {
        type: DataTypes.STRING,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: "User",
      tableName: "users",
      timestamps: true,
      paranoid: true,
    },
  );
}
