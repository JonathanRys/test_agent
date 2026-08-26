import { DataTypes, Model, Sequelize } from "sequelize";

export class Summit extends Model {
  declare id: number;
  declare adventureId: number;
  declare mountainId: number;
  declare completedAt: Date;
}

export function initSummit(sequelize: Sequelize): void {
  Summit.init(
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
      mountainId: {
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
      modelName: "Summit",
      tableName: "summits",
      timestamps: false,
    },
  );
}
