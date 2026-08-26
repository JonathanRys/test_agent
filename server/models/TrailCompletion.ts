import { DataTypes, Model, Sequelize } from "sequelize";

export class TrailCompletion extends Model {
  declare id: number;
  declare adventureId: number;
  declare trailId: number;
  declare completedAt: Date;
}

export function initTrailCompletion(sequelize: Sequelize): void {
  TrailCompletion.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      adventureId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      trailId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      completedAt: {
        type: DataTypes.DATE,
        allowNull: false,
      },
    },
    {
      sequelize,
      modelName: "TrailCompletion",
      tableName: "trailCompletions",
      timestamps: false,
    },
  );
}
