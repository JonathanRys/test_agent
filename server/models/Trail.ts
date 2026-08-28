import { DataTypes, Model, Sequelize } from "sequelize";
import type { ModelStatic } from "sequelize";

interface DBModels {
  State: ModelStatic<Model>;
  TrailCompletion: ModelStatic<Model>;
  List: ModelStatic<Model>;
  TrailList: ModelStatic<Model>;
}

export class Trail extends Model {
  declare id: number;
  declare name: string;
  declare description: string;
  declare required: boolean;
  declare state: string;
  declare distance: number;
  declare elevationGain: number;
  declare elevationLoss: number;
  declare startLat: number;
  declare startLon: number;
  declare endLat: number;
  declare endLon: number;
  declare gpx: string;
  declare embeddedGpx: string;
  static associate(models: DBModels) {
    this.hasMany(models.TrailCompletion, { foreignKey: "trailId" });
    this.belongsTo(models.State, { foreignKey: "stateId", as: "state" });
    this.belongsToMany(models.List, {
      through: models.TrailList,
      foreignKey: "trailId",
      otherKey: "listId",
    });
  }
}

export function initTrail(sequelize: Sequelize): void {
  Trail.init(
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
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      required: {
        type: DataTypes.BOOLEAN,
        allowNull: true,
      },
      stateId: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      distance: {
        type: DataTypes.FLOAT,
        allowNull: true,
      },
      elevationGain: {
        type: DataTypes.FLOAT,
        allowNull: true,
      },
      elevationLoss: {
        type: DataTypes.FLOAT,
        allowNull: true,
      },
      startLat: {
        type: DataTypes.FLOAT,
        allowNull: true,
      },
      startLon: {
        type: DataTypes.FLOAT,
        allowNull: false,
      },
      endLat: {
        type: DataTypes.FLOAT,
        allowNull: true,
      },
      endLon: {
        type: DataTypes.FLOAT,
        allowNull: true,
      },
      gpx: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      embeddedGpx: {
        type: DataTypes.STRING,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: "Trail",
      tableName: "trails",
      timestamps: false,
    },
  );
}
