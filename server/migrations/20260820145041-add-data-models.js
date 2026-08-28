"use strict";

import { createTableFromModel } from "../utils/migration.ts";

import { Mountain, initMountain } from "../models/Mountain.ts";
import { Trail, initTrail } from "../models/Trail.ts";
import { List, initList } from "../models/List.ts";
import { MountainList, initMountainList } from "../models/MountainList.ts";
import { TrailList, initTrailList } from "../models/TrailList.ts";
import { State, initState } from "../models/State.ts";

/** @type {import('sequelize-cli').Migration} */
export default {
  async up(queryInterface, Sequelize) {
    [
      initState,
      initMountain,
      initTrail,
      initList,
      initMountainList,
      initTrailList,
    ].forEach((initMethod) => {
      initMethod(queryInterface.sequelize);
    });

    [State, Mountain, Trail, List, MountainList, TrailList].forEach(
      async (model) => {
        await createTableFromModel(queryInterface, model);
      },
    );
  },

  async down(queryInterface, Sequelize) {
    [
      initState,
      initMountain,
      initTrail,
      initList,
      initMountainList,
      initTrailList,
    ].forEach((initMethod) => {
      initMethod(queryInterface.sequelize);
    });

    try {
      await queryInterface.sequelize.query("PRAGMA foreign_keys = OFF;");

      [State, Mountain, Trail, List, MountainList, TrailList].forEach(
        async (model) => {
          await queryInterface.dropTable(model.tableName);
        },
      );
    } finally {
      await queryInterface.sequelize.query("PRAGMA foreign_keys = ON;");
    }
  },
};
