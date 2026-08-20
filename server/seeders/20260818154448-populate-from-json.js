"use strict";

// Mountains
import fiftyTwoWav from "../data/mountains/52wav.json" with { type: "json" };
import acadia26 from "../data/mountains/acadia26.json" with { type: "json" };
import adk46 from "../data/mountains/adk46.json" with { type: "json" };
import belknapHiker from "../data/mountains/belknapHiker.json" with { type: "json" };
import catskill35 from "../data/mountains/catskill35.json" with { type: "json" };
import ne67 from "../data/mountains/ne67.json" with { type: "json" };
import nh48 from "../data/mountains/nh48.json" with { type: "json" };
import nhhh from "../data/mountains/nhhh.json" with { type: "json" };

// Trails
import r2r from "../data/mountains/r2r.json" with { type: "json" };

// Lists
import lists from "../data/lists.json" with { type: "json" };

/** @type {import('sequelize-cli').Migration} */
export default {
  async up(queryInterface, Sequelize) {
    /**
     * Add seed commands here.
     *
     * Example:
     * await queryInterface.bulkInsert('People', [{
     *   name: 'John Doe',
     *   isBetaMember: false
     * }], {});
     */

    // Mountains
    await queryInterface.bulkInsert("mountains", fiftyTwoWav, {});
    await queryInterface.bulkInsert("mountains", acadia26, {});
    await queryInterface.bulkInsert("mountains", adk46, {});
    await queryInterface.bulkInsert("mountains", belknapHiker, {});
    await queryInterface.bulkInsert("mountains", catskill35, {});
    await queryInterface.bulkInsert("mountains", ne67, {});
    await queryInterface.bulkInsert("mountains", nh48, {});
    await queryInterface.bulkInsert("mountains", nhhh, {});

    // Trails
    await queryInterface.bulkInsert("trails", r2r, {});

    // Lists
    await queryInterface.bulkInsert("lists", lists, {});
  },

  async down(queryInterface, Sequelize) {
    /**
     * Add commands to revert seed here.
     *
     * Example:
     * await queryInterface.bulkDelete('People', null, {});
     */

    await queryInterface.bulkDelete("mountains", null, {});
    await queryInterface.bulkDelete("trails", null, {});
    await queryInterface.bulkDelete("lists", null, {});
  },
};
