import { DataTypes, Model, Sequelize } from "sequelize";
import type { ModelStatic } from "sequelize";

interface DBModels {
  User: ModelStatic<Model>;
  Adventure: ModelStatic<Model>;
  Mountain: ModelStatic<Model>;
}

export class Summit extends Model {
  declare id: number;
  declare userId: number;
  declare adventureId: number;
  declare mountainId: number;
  declare completedAt: Date;
  declare season: string | null;
  static associate(models: DBModels) {
    this.belongsTo(models.User, { foreignKey: "userId" });
    this.belongsTo(models.Adventure, { foreignKey: "adventureId" });
    this.belongsTo(models.Mountain, { foreignKey: "mountainId" });
  }
}

export function initSummit(sequelize: Sequelize): void {
  Summit.init(
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
      mountainId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      completedAt: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      season: {
        type: DataTypes.STRING,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: "Summit",
      tableName: "summits",
      timestamps: false,
    },
  );
}
