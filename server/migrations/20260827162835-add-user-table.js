"use strict";

import { createTableFromModel } from "../utils/migration.ts";

import { User, initUser } from "../models/User.ts";

// Agent
import { Session, initSession } from "../models/Session.ts";

// Adventure
import { Adventure, initAdventure } from "../models/Adventure.ts";
import { Summit, initSummit } from "../models/Summit.ts";
import {
  TrailCompletion,
  initTrailCompletion,
} from "../models/TrailCompletion.ts";

/** @type {import('sequelize-cli').Migration} */
export default {
  async up(queryInterface, Sequelize) {
    [
      initUser,
      initSession,
      initAdventure,
      initSummit,
      initTrailCompletion,
    ].forEach((initMethod) => {
      initMethod(queryInterface.sequelize);
    });

    createTableFromModel(queryInterface, User);

    // Add columns to linked tables
    const columnConfig = {
      type: Sequelize.INTEGER,
      allowNull: true, // initialize with true and update after user data exists
      references: {
        model: User.tableName,
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    };

    const [existingUsers] = await queryInterface.sequelize.query(
      `SELECT id FROM ${User.tableName} WHERE email = 'system@jonathanrys.com' LIMIT 1;`,
    );

    let defaultUserId;
    if (existingUsers.length > 0) {
      defaultUserId = existingUsers[0].id;
    } else {
      defaultUserId = await queryInterface
        .bulkInsert(
          User.tableName,
          [
            {
              name: "system",
              email: "system@jonathanrys.com",
              password: "",
              fitnessLevel: "expert",
              homeLocation: "Somerville, MA",
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          ],
          { returning: ["id"] },
        )
        .then((result) => {
          // Handle database engine differences (PostgreSQL returns an array, MySQL returns an integer ID)
          return Array.isArray(result) ? result[0].id : result;
        });
    }

    // Update all existing legacy rows to point to our fallback system user
    await queryInterface.sequelize.query(
      `UPDATE "${Session.tableName}" SET "userId" = :userId WHERE "userId" IS NULL;`,
      {
        replacements: { userId: defaultUserId },
      },
    );
    await queryInterface.sequelize.query(
      `UPDATE "${Adventure.tableName}" SET "userId" = :userId WHERE "userId" IS NULL;`,
      {
        replacements: { userId: defaultUserId },
      },
    );
    await queryInterface.sequelize.query(
      `UPDATE "${Summit.tableName}" SET "userId" = :userId WHERE "userId" IS NULL;`,
      {
        replacements: { userId: defaultUserId },
      },
    );
    await queryInterface.sequelize.query(
      `UPDATE "${TrailCompletion.tableName}" SET "userId" = :userId WHERE "userId" IS NULL;`,
      {
        replacements: {
          userId: defaultUserId,
        },
      },
    );

    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query("PRAGMA foreign_keys = OFF;", {
        transaction,
      });
      await queryInterface.sequelize.query(`PRAGMA writable_schema = ON;`, {
        transaction,
      });

      // Now that no rows contain NULL, safely enforce the NOT NULL constraint
      await queryInterface.sequelize.query(
        `UPDATE sqlite_master SET sql = replace(sql, '"userId" INTEGER', '"userId" INTEGER NOT NULL') WHERE name = '${Session.tableName}' AND type = 'table';`,
        { transaction },
      );
      await queryInterface.sequelize.query(
        `UPDATE sqlite_master SET sql = replace(sql, '"userId" INTEGER', '"userId" INTEGER NOT NULL') WHERE name = '${Adventure.tableName}' AND type = 'table';`,
        { transaction },
      );
      await queryInterface.sequelize.query(
        `UPDATE sqlite_master SET sql = replace(sql, '"userId" INTEGER', '"userId" INTEGER NOT NULL') WHERE name = '${Summit.tableName}' AND type = 'table';`,
        { transaction },
      );
      await queryInterface.sequelize.query(
        `UPDATE sqlite_master SET sql = replace(sql, '"userId" INTEGER', '"userId" INTEGER NOT NULL') WHERE name = '${TrailCompletion.tableName}' AND type = 'table';`,
        { transaction },
      );

      await queryInterface.sequelize.query("PRAGMA foreign_keys = ON;", {
        transaction,
      });
      await queryInterface.sequelize.query(`PRAGMA writable_schema = OFF;`, {
        transaction,
      });
    });
  },

  async down(queryInterface, Sequelize) {
    [
      initUser,
      initSession,
      initAdventure,
      initSummit,
      initTrailCompletion,
    ].forEach((initMethod) => {
      initMethod(queryInterface.sequelize);
    });

    try {
      await queryInterface.sequelize.query("PRAGMA foreign_keys = OFF;");

      await queryInterface.removeColumn(Session.tableName, "userId");
      await queryInterface.removeColumn(Adventure.tableName, "userId");
      await queryInterface.removeColumn(Summit.tableName, "userId");
      await queryInterface.removeColumn(TrailCompletion.tableName, "userId");

      await queryInterface.dropTable(User.tableName);
    } finally {
      await queryInterface.sequelize.query("PRAGMA foreign_keys = ON;");
    }
  },
};
