import { DataTypes, Model, Sequelize } from "sequelize";
import type { ModelStatic } from "sequelize";

interface DBModels {
  User: ModelStatic<Model>;
  Adventure: ModelStatic<Model>;
  Trail: ModelStatic<Model>;
}

export class TrailCompletion extends Model {
  declare id: number;
  declare userId: number;
  declare adventureId: number;
  declare trailId: number;
  declare completedAt: Date;
  static associate(models: DBModels) {
    this.belongsTo(models.User, { foreignKey: "userId" });
    this.belongsTo(models.Adventure, { foreignKey: "adventureId" });
    this.belongsTo(models.Trail, { foreignKey: "trailId" });
  }
}

export function initTrailCompletion(sequelize: Sequelize): void {
  TrailCompletion.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
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
