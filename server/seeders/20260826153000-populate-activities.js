"use strict";

import activities from "../data/activities.json" with { type: "json" };

/** @type {import('sequelize-cli').Migration} */
export default {
  async up(queryInterface) {
    const activityRows = activities.filter((row) => row.name !== "Empty");
    await queryInterface.bulkInsert("activities", activityRows, {});
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete("activities", null, {});
  },
};
