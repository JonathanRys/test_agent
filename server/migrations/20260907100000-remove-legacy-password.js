"use strict";

/** @type {import('sequelize-cli').Migration} */
export default {
  async up(queryInterface) {
    await queryInterface.sequelize.query("PRAGMA foreign_keys = OFF;");
    try {
      await queryInterface.removeColumn("users", "password");
    } finally {
      await queryInterface.sequelize.query("PRAGMA foreign_keys = ON;");
    }
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.addColumn("users", "password", {
      type: Sequelize.STRING,
      allowNull: true,
    });
  },
};
