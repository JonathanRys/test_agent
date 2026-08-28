import { DataTypes, Model, Sequelize } from "sequelize";
import type { ModelStatic } from "sequelize";

interface DBModels {
  Adventure: ModelStatic<Model>;
}

export class Activity extends Model {
  declare id: number;
  declare name: string;
  declare parentActivity: number | null;
  static associate(models: DBModels) {
    this.hasMany(models.Adventure, { foreignKey: "activityId" });
    this.hasMany(this, {
      foreignKey: "parentActivity",
      as: "children",
    });
    this.belongsTo(this, {
      foreignKey: "parentActivity",
      as: "parent",
    });
  }
}

export function initActivity(sequelize: Sequelize): void {
  Activity.init(
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
      parentActivity: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: "Activity",
      tableName: "activities",
      timestamps: false,
    },
  );
}
