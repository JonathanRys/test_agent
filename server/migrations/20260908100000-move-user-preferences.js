"use strict";

/** @type {import('sequelize-cli').Migration} */
export default {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("userPreferences", "birthdate", {
      type: Sequelize.DATEONLY,
      allowNull: true,
    });

    await queryInterface.sequelize.query(`
      INSERT OR IGNORE INTO "userPreferences"
        ("userId", "birthdate", "fitnessLevel", "homeLocation", "createdAt", "updatedAt")
      SELECT "id", "birthdate", "fitnessLevel", "homeLocation", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      FROM "users";
    `);
    await queryInterface.sequelize.query(`
      UPDATE "userPreferences"
      SET "birthdate" = COALESCE("birthdate", (SELECT "birthdate" FROM "users" WHERE "users"."id" = "userPreferences"."userId")),
          "fitnessLevel" = COALESCE("fitnessLevel", (SELECT "fitnessLevel" FROM "users" WHERE "users"."id" = "userPreferences"."userId")),
          "homeLocation" = COALESCE("homeLocation", (SELECT "homeLocation" FROM "users" WHERE "users"."id" = "userPreferences"."userId"));
    `);

    await queryInterface.sequelize.query(
      'ALTER TABLE "users" DROP COLUMN "birthdate";',
    );
    await queryInterface.sequelize.query(
      'ALTER TABLE "users" DROP COLUMN "fitnessLevel";',
    );
    await queryInterface.sequelize.query(
      'ALTER TABLE "users" DROP COLUMN "homeLocation";',
    );
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.addColumn("users", "birthdate", {
      type: Sequelize.DATEONLY,
      allowNull: true,
    });
    await queryInterface.addColumn("users", "fitnessLevel", {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn("users", "homeLocation", {
      type: Sequelize.STRING,
      allowNull: true,
    });

    await queryInterface.sequelize.query(`
      UPDATE "users"
      SET "birthdate" = (SELECT "birthdate" FROM "userPreferences" WHERE "userPreferences"."userId" = "users"."id"),
          "fitnessLevel" = (SELECT "fitnessLevel" FROM "userPreferences" WHERE "userPreferences"."userId" = "users"."id"),
          "homeLocation" = (SELECT "homeLocation" FROM "userPreferences" WHERE "userPreferences"."userId" = "users"."id");
    `);
    await queryInterface.removeColumn("userPreferences", "birthdate");
  },
};
