"use strict";

import { createTableFromModel } from "../utils/migration.ts";
import { Activity, initActivity } from "../models/Activity.ts";
import { Adventure, initAdventure } from "../models/Adventure.ts";
import { Summit, initSummit } from "../models/Summit.ts";

import {
  TrailCompletion,
  initTrailCompletion,
} from "../models/TrailCompletion.ts";

/** @type {import('sequelize-cli').Migration} */
export default {
  async up(queryInterface) {
    [initActivity, initAdventure, initSummit, initTrailCompletion].forEach(
      (initMethod) => {
        initMethod(queryInterface.sequelize);
      },
    );

    for (const model of [Activity, Adventure, Summit, TrailCompletion]) {
      await createTableFromModel(queryInterface, model);
    }
  },

  async down(queryInterface) {
    [initActivity, initAdventure, initSummit, initTrailCompletion].forEach(
      (initMethod) => {
        initMethod(queryInterface.sequelize);
      },
    );

    try {
      await queryInterface.sequelize.query("PRAGMA foreign_keys = OFF;");

      for (const model of [TrailCompletion, Summit, Adventure, Activity]) {
        await queryInterface.dropTable(model.tableName);
      }
    } finally {
      await queryInterface.sequelize.query("PRAGMA foreign_keys = ON;");
    }
  },
};
