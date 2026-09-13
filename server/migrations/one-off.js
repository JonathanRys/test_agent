/* Script to make quick one-off updates */
import { Sequelize } from "sequelize";
import path from "path";
import { fileURLToPath } from "url";

import fiftyTwoWav from "../data/mountains/52wav.json" with { type: "json" };
import acadia26 from "../data/mountains/acadia26.json" with { type: "json" };
import adk46 from "../data/mountains/adk46.json" with { type: "json" };
import belknapHiker from "../data/mountains/belknapHiker.json" with { type: "json" };
import catskill35 from "../data/mountains/catskill35.json" with { type: "json" };
import ne67 from "../data/mountains/ne67.json" with { type: "json" };
import nh48 from "../data/mountains/nh48.json" with { type: "json" };
import nhhh from "../data/mountains/nhhh.json" with { type: "json" };
import nehh from "../data/mountains/nehh.json" with { type: "json" };
import trw72 from "../data/mountains/trw72.json" with { type: "json" };
import ca14ers from "../data/mountains/ca14ers.json" with { type: "json" };
import co14ers from "../data/mountains/co14ers.json" with { type: "json" };
import fireTowers from "../data/mountains/fireTowers.json" with { type: "json" };
import highPointers from "../data/mountains/highPointers.json" with { type: "json" };

import mountainLists from "../data/mountainLists.json" with { type: "json" };

// import states from "../data/states.json" with { type: "json" };

// import { State, initState } from "../models/State.ts";
import { Mountain, initMountain } from "../models/Mountain.ts";
// import { Trail, initTrail } from "../models/Trail.ts";
// import { Summit, initSummit } from "../models/Summit.ts";
// import { List, initList } from "../models/List.ts";
import { MountainList, initMountainList } from "../models/MountainList.ts";
// import { TrailList, initTrailList } from "../models/TrailList.ts";
// import {
//   TrailCompletion,
//   initTrailCompletion,
// } from "../models/TrailCompletion.ts";

export const createTableFromModel = async (sequelize, model) => {
  const tableName = model.tableName;
  const attributes = model.getAttributes();

  await sequelize.queryInterface.createTable(tableName, attributes);
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, "../../data/memory.db");

const sequelize = new Sequelize({
  dialect: "sqlite",
  storage: dbPath,
  logging: false,
});

async function runOneTimeQuery() {
  try {
    await sequelize.query("PRAGMA foreign_keys = OFF;");

    // initState(sequelize);
    initMountain(sequelize);
    // initTrail(sequelize);
    // initSummit(sequelize);
    // initList(sequelize);
    initMountainList(sequelize);
    // initTrailList(sequelize);
    // initTrailCompletion(sequelize);

    // sequelize.queryInterface.dropTable(State.tableName);

    sequelize.queryInterface.dropTable(Mountain.tableName);
    sequelize.queryInterface.dropTable(MountainList.tableName);

    // const [results, metadata] = await sequelize.query(
    //   "UPDATE lists SET description = $1 WHERE name = 'New Hampshire Hundred Highest'",
    //   {
    //     bind: ["The 100 tallest mountains in NH."],
    //     type: sequelize.QueryTypes.UPDATE,
    //   },
    // );
    // await createTableFromModel(sequelize, State);

    await createTableFromModel(sequelize, Mountain);
    await createTableFromModel(sequelize, MountainList);

    const models = {
      // State,
      // Mountain,
      // Trail,
      // Summit,
      // TrailCompletion,
      // List,
      // MountainList,
      // TrailList,
    };

    // await sequelize.queryInterface.bulkInsert("states", states, {});

    await sequelize.queryInterface.bulkInsert("mountains", fiftyTwoWav, {});
    await sequelize.queryInterface.bulkInsert("mountains", acadia26, {});
    await sequelize.queryInterface.bulkInsert("mountains", adk46, {});
    await sequelize.queryInterface.bulkInsert("mountains", belknapHiker, {});
    await sequelize.queryInterface.bulkInsert("mountains", catskill35, {});
    await sequelize.queryInterface.bulkInsert("mountains", ne67, {});
    await sequelize.queryInterface.bulkInsert("mountains", nh48, {});
    await sequelize.queryInterface.bulkInsert("mountains", nhhh, {});
    await sequelize.queryInterface.bulkInsert("mountains", nehh, {});
    await sequelize.queryInterface.bulkInsert("mountains", trw72, {});
    await sequelize.queryInterface.bulkInsert("mountains", ca14ers, {});
    await sequelize.queryInterface.bulkInsert("mountains", co14ers, {});
    await sequelize.queryInterface.bulkInsert("mountains", fireTowers, {});
    await sequelize.queryInterface.bulkInsert("mountains", highPointers, {});

    await sequelize.queryInterface.bulkInsert(
      "mountainLists",
      mountainLists,
      {},
    );

    // Object.values({ Mountain, Trail }).forEach((model) => {
    //   if (typeof model.associate === "function") {
    //     model.associate(models);
    //   }
    // });

    // await sequelize.query(
    //   'INSERT INTO "mountainLists" ("mountainId", "listId") VALUES (460, 17);',
    // );

    // for (let i = 0; i < highPointers.length; i++) {
    //   await sequelize.query("UPDATE mountains SET height=$1 WHERE name=$2", {
    //     bind: [highPointers[i].height, highPointers[i].name],
    //     type: sequelize.QueryTypes.UPDATE,
    //   });
    // }

    // await sequelize.query();
  } catch (error) {
    console.error("Query failed:", error);
  } finally {
    await sequelize.query("PRAGMA foreign_keys = ON;");
    await sequelize.close();
  }
}

runOneTimeQuery();
