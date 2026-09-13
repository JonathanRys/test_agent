"use strict";

/** @type {import('sequelize-cli').Migration} */
export default {
  async up(queryInterface) {
    await queryInterface.addIndex(
      "summits",
      ["userId", "mountainId", "completedAt"],
      {
        name: "summits_user_mountain_completed_at_unique",
        unique: true,
      },
    );
    await queryInterface.addIndex(
      "trailCompletions",
      ["userId", "trailId", "completedAt"],
      {
        name: "trail_completions_user_trail_completed_at_unique",
        unique: true,
      },
    );
  },

  async down(queryInterface) {
    await queryInterface.removeIndex(
      "trailCompletions",
      "trail_completions_user_trail_completed_at_unique",
    );
    await queryInterface.removeIndex(
      "summits",
      "summits_user_mountain_completed_at_unique",
    );
  },
};
