"use strict";

/** @type {import('sequelize-cli').Migration} */
export default {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("summits", "season", {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn("trailCompletions", "season", {
      type: Sequelize.STRING,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("summits", "season");
    await queryInterface.removeColumn("trailCompletions", "season");
  },
};