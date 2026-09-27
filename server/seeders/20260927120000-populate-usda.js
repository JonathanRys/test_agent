"use strict";

import usdaRegions from "../data/usdaRegions.json" with { type: "json" };
import usdaParks from "../data/usdaParks.json" with { type: "json" };

const usdaRegionsTable = "usdaRegions";
const usdaParksTable = "usdaParks";

/** @type {import('sequelize-cli').Migration} */
export default {
  async up(queryInterface) {
    await queryInterface.bulkInsert(usdaRegionsTable, usdaRegions, {});
    await queryInterface.bulkInsert(usdaParksTable, usdaParks, {});
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query("PRAGMA foreign_keys = OFF;");
    await queryInterface.bulkDelete(usdaParksTable, null, {});
    await queryInterface.bulkDelete(usdaRegionsTable, null, {});
    await queryInterface.sequelize.query("PRAGMA foreign_keys = ON;");
  },
};
