"use strict";

/** @type {import('sequelize-cli').Migration} */
export default {
  async up(queryInterface, Sequelize) {
    const columns = await queryInterface.describeTable("users");
    if (!columns.isPaid) {
      await queryInterface.addColumn("users", "isPaid", {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      });
    }
    if (!columns.accessDenied) {
      await queryInterface.addColumn("users", "accessDenied", {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      });
    }
  },

  async down(queryInterface) {
    const columns = await queryInterface.describeTable("users");
    if (columns.accessDenied) await queryInterface.removeColumn("users", "accessDenied");
    if (columns.isPaid) await queryInterface.removeColumn("users", "isPaid");
  },
};