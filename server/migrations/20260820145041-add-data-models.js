"use strict";
import { Sequelize } from "sequelize";

import { Mountain, initMountain } from "../models/Mountain.ts";
import { Trail, initTrail } from "../models/Trail.ts";
import { List, initList } from "../models/List.ts";
import { MountainList, initMountainList } from "../models/MountainList.ts";
import { TrailList, initTrailList } from "../models/TrailList.ts";
import { State, initState } from "../models/State.ts";
import { User, initUser } from "../models/User.ts";
import { Activity, initActivity } from "../models/Activity.ts";
import { Adventure, initAdventure } from "../models/Adventure.ts";

const initTable = async () => {
  const tempSequelize = new Sequelize({ dialect: "sqlite" });
  initMethod(tempSequelize);
};

const createTableFromModel = async (queryInterface, model, initMethod) => {
  const tableName = model.tableName;
  const attributes = model.getAttributes();

  await queryInterface.createTable(tableName, attributes);
};

/** @type {import('sequelize-cli').Migration} */
export default {
  async up(queryInterface, Sequelize) {
    [
      initState,
      initMountain,
      initTrail,
      initList,
      initMountainList,
      initTrailList,
    ].forEach((initMethod) => {
      initMethod(queryInterface.sequelize);
    });

    [State, Mountain, Trail, List, MountainList, TrailList].forEach(
      async (model) => {
        await createTableFromModel(queryInterface, model);
      },
    );

    Mountain.belongsToMany(List, {
      through: MountainList,
      foreignKey: "mountainId",
      otherKey: "listId",
    });

    List.belongsToMany(Mountain, {
      through: MountainList,
      foreignKey: "listId",
      otherKey: "mountainId",
    });

    Trail.belongsToMany(List, {
      through: TrailList,
      foreignKey: "trailId",
      otherKey: "listId",
    });

    List.belongsToMany(Trail, {
      through: TrailList,
      foreignKey: "listId",
      otherKey: "trailId",
    });

    State.hasMany(Mountain, { foreignKey: "stateId" });
    Mountain.belongsTo(State, { foreignKey: "stateId", as: "state" });

    State.hasMany(Trail, { foreignKey: "stateId" });
    Trail.belongsTo(State, { foreignKey: "stateId", as: "state" });
  },

  async down(queryInterface, Sequelize) {
    [
      initState,
      initMountain,
      initTrail,
      initList,
      initMountainList,
      initTrailList,
    ].forEach((initMethod) => {
      initMethod(queryInterface.sequelize);
    });

    try {
      await queryInterface.sequelize.query("PRAGMA foreign_keys = OFF;");

      [State, Mountain, Trail, List, MountainList, TrailList].forEach(
        async (model) => {
          await queryInterface.dropTable(model.tableName);
        },
      );
    } finally {
      await queryInterface.sequelize.query("PRAGMA foreign_keys = ON;");
    }
  },
};
