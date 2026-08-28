"use strict";

import { createTableFromModel } from "../utils/migration.ts";
import { Season, initSeason } from "../models/Season.ts";
import { SeasonDate, initSeasonDate } from "../models/SeasonDate.ts";

const modelsMap = {
  Season,
  SeasonDate,
};
const initMethods = [initSeason, initSeasonDate];

/** @type {import('sequelize-cli').Migration} */
export default {
  async up(queryInterface, Sequelize) {
    initMethods.forEach((initMethod) => {
      initMethod(queryInterface.sequelize);
    });

    await createTableFromModel(queryInterface, Season);
    await createTableFromModel(queryInterface, SeasonDate);

    Object.values(modelsMap).forEach((model) => {
      if (typeof model.associate === "function") {
        model.associate(modelsMap); // Passes the full models pool down to the model class
      }
    });
  },

  async down(queryInterface, Sequelize) {
    initMethods.forEach((initMethod) => {
      initMethod(queryInterface.sequelize);
    });

    await queryInterface.sequelize.query("PRAGMA foreign_keys = OFF;");
    await queryInterface.dropTable(Season.tableName);
    await queryInterface.dropTable(SeasonDate.tableName);
    await queryInterface.sequelize.query("PRAGMA foreign_keys = ON;");
  },
};
