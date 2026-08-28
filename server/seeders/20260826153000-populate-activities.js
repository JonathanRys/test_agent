"use strict";

import activities from "../data/activities.json" with { type: "json" };

/** @type {import('sequelize-cli').Migration} */
export default {
  async up(queryInterface) {
    const activityRows = activities.filter((row) => row.name !== "Empty");
    await queryInterface.bulkInsert("activities", activityRows, {});
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query("PRAGMA foreign_keys = OFF;");
    await queryInterface.bulkDelete("activities", null, {});
    await queryInterface.sequelize.query("PRAGMA foreign_keys = ON;");
  },
};
