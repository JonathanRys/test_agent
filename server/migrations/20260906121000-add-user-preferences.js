"use strict";

/** @type {import('sequelize-cli').Migration} */
export default {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("userPreferences", {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      userId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        unique: true,
        references: { model: "users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      fitnessLevel: { type: Sequelize.STRING, allowNull: true },
      homeLocation: { type: Sequelize.STRING, allowNull: true },
      units: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: "imperial",
      },
      interests: { type: Sequelize.JSON, allowNull: false, defaultValue: "[]" },
      publicProfile: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      publicRatings: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("userPreferences");
  },
};
