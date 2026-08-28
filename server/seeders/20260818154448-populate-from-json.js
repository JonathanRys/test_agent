"use strict";

// States
import states from "../data/states.json" with { type: "json" };

// Mountains
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

// Trails
import r2r from "../data/trails/r2r.json" with { type: "json" };

// Lists
import lists from "../data/lists.json" with { type: "json" };

// Connections
import mountainLists from "../data/mountainLists.json" with { type: "json" };
import trailLists from "../data/trailLists.json" with { type: "json" };

/** @type {import('sequelize-cli').Migration} */
export default {
  async up(queryInterface, Sequelize) {
    // States
    await queryInterface.bulkInsert("states", states, {});

    // Mountains
    await queryInterface.bulkInsert("mountains", fiftyTwoWav, {});
    await queryInterface.bulkInsert("mountains", acadia26, {});
    await queryInterface.bulkInsert("mountains", adk46, {});
    await queryInterface.bulkInsert("mountains", belknapHiker, {});
    await queryInterface.bulkInsert("mountains", catskill35, {});
    await queryInterface.bulkInsert("mountains", ne67, {});
    await queryInterface.bulkInsert("mountains", nh48, {});
    await queryInterface.bulkInsert("mountains", nhhh, {});
    await queryInterface.bulkInsert("mountains", nehh, {});
    await queryInterface.bulkInsert("mountains", trw72, {});
    await queryInterface.bulkInsert("mountains", ca14ers, {});
    await queryInterface.bulkInsert("mountains", co14ers, {});
    await queryInterface.bulkInsert("mountains", fireTowers, {});
    await queryInterface.bulkInsert("mountains", highPointers, {});

    // Trails
    const processedR2rData = r2r.map((row) => ({
      ...row,
      gpx: JSON.stringify(row.gpx),
    }));

    await queryInterface.bulkInsert("trails", processedR2rData, {});

    // Lists
    await queryInterface.bulkInsert("lists", lists, {});

    // Connections
    await queryInterface.bulkInsert("mountainLists", mountainLists, {});
    await queryInterface.bulkInsert("trailLists", trailLists, {});
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete("states", null, {});
    await queryInterface.bulkDelete("mountains", null, {});
    await queryInterface.bulkDelete("trails", null, {});
    await queryInterface.bulkDelete("lists", null, {});
    await queryInterface.bulkDelete("mountainLists", null, {});
    await queryInterface.bulkDelete("trailLists", null, {});
  },
};
