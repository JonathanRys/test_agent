"use strict";

import { createTableFromModel } from "../utils/migration.ts";
import { UsdaRegion, initUsdaRegion } from "../models/UsdaRegion.ts";
import { UsdaPark, initUsdaPark } from "../models/UsdaPark.ts";

const initMethods = [initUsdaRegion, initUsdaPark];

/** @type {import('sequelize-cli').Migration} */
export default {
  async up(queryInterface, Sequelize) {
    initMethods.forEach((initMethod) => {
      initMethod(queryInterface.sequelize);
    });

    await createTableFromModel(queryInterface, UsdaRegion);
    await createTableFromModel(queryInterface, UsdaPark);
    // NOTE: no associate() call here. State.hasMany references Mountain/Trail,
    // which are not initialized in this migration's scope, so associating here
    // throws "called with something that's not a subclass of Sequelize.Model".
    // The park/region tables carry no FK constraints (plain INTEGER columns,
    // matching the rest of the schema), and associations are wired at runtime
    // in models/index.ts via initializeModels().
  },

  async down(queryInterface, Sequelize) {
    initMethods.forEach((initMethod) => {
      initMethod(queryInterface.sequelize);
    });

    await queryInterface.sequelize.query("PRAGMA foreign_keys = OFF;");
    await queryInterface.dropTable(UsdaPark.tableName);
    await queryInterface.dropTable(UsdaRegion.tableName);
    await queryInterface.sequelize.query("PRAGMA foreign_keys = ON;");
  },
};
