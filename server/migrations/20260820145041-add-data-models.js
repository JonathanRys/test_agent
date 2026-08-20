"use strict";
import { Sequelize } from "sequelize";

import { Mountain, initMountain } from "../models/Mountain.ts";
import { Trail, initTrail } from "../models/Trail.ts";
import { List, initList } from "../models/List.ts";
import { MountainList, initMountainList } from "../models/MountainList.ts";
import { TrailList, initTrailList } from "../models/TrailList.ts";

const initTable = async () => {
  const tempSequelize = new Sequelize({ dialect: "sqlite" });
  initMethod(tempSequelize);
};

const createTableFromModel = async (queryInterface, model, initMethod) => {
  // 1. Access the raw table name from the model configuration
  const tableName = model.tableName;

  // 2. Extract the attribute definitions you defined in your model's init method
  const attributes = model.getAttributes();

  // 3. Pass those attributes directly to createTable
  await queryInterface.createTable(tableName, attributes);
};

/** @type {import('sequelize-cli').Migration} */
export default {
  async up(queryInterface, Sequelize) {
    /**
     * Add altering commands here.
     *
     * Example:
     * await queryInterface.createTable('users', { id: Sequelize.INTEGER });
     */

    [
      initMountain,
      initTrail,
      initList,
      initMountainList,
      initTrailList,
    ].forEach((initMethod) => {
      initMethod(queryInterface.sequelize);
    });

    [Mountain, Trail, List, MountainList, TrailList].forEach(async (model) => {
      await createTableFromModel(queryInterface, model);
    });
  },

  async down(queryInterface, Sequelize) {
    /**
     * Add reverting commands here.
     *
     * Example:
     * await queryInterface.dropTable('users');
     */
    [
      initMountain,
      initTrail,
      initList,
      initMountainList,
      initTrailList,
    ].forEach((initMethod) => {
      initMethod(queryInterface.sequelize);
    });

    [Mountain, Trail, List, MountainList, TrailList].forEach(async (model) => {
      await queryInterface.dropTable(model.tableName);
    });
  },
};
