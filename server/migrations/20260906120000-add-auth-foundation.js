"use strict";

/** @type {import('sequelize-cli').Migration} */
export default {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("users", "passwordHash", {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn("users", "emailVerifiedAt", {
      type: Sequelize.DATE,
      allowNull: true,
    });
    await queryInterface.addColumn("users", "birthdate", {
      type: Sequelize.DATEONLY,
      allowNull: true,
    });

    await queryInterface.sequelize.query(
      'UPDATE "users" SET "email" = lower("email") WHERE "email" IS NOT NULL;',
    );
    await queryInterface.addIndex("users", ["email"], {
      unique: true,
      name: "users_email_unique",
    });

    await queryInterface.createTable("authSessions", {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      userId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      accessTokenHash: {
        type: Sequelize.STRING(64),
        allowNull: false,
        unique: true,
      },
      refreshTokenHash: {
        type: Sequelize.STRING(64),
        allowNull: false,
        unique: true,
      },
      accessExpiresAt: { type: Sequelize.DATE, allowNull: false },
      refreshExpiresAt: { type: Sequelize.DATE, allowNull: false },
      revokedAt: { type: Sequelize.DATE, allowNull: true },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex("authSessions", ["userId"]);
  },

  async down(queryInterface) {
    await queryInterface.dropTable("authSessions");
    await queryInterface.removeIndex("users", "users_email_unique");
    await queryInterface.removeColumn("users", "birthdate");
    await queryInterface.removeColumn("users", "emailVerifiedAt");
    await queryInterface.removeColumn("users", "passwordHash");
  },
};
