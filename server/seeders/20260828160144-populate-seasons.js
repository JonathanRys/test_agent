"use strict";

import seasons from "../data/seasons.json" with { type: "json" };
import seasonDates from "../data/seasonDates.json" with { type: "json" };

const seasonsTable = "seasons";
const seasonDatesTable = "seasonDates";

/** @type {import('sequelize-cli').Migration} */
export default {
  async up(queryInterface) {
    await queryInterface.bulkInsert(seasonsTable, seasons, {});
    await queryInterface.bulkInsert(seasonDatesTable, seasonDates, {});
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query("PRAGMA foreign_keys = OFF;");
    await queryInterface.bulkDelete(seasonsTable, null, {});
    await queryInterface.bulkDelete(seasonDatesTable, null, {});
    await queryInterface.sequelize.query("PRAGMA foreign_keys = ON;");
  },
};
