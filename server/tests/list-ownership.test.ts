import { afterAll, describe, expect, it } from "vitest";
import {
  Adventure,
  List,
  MountainList,
  Summit,
  User,
} from "../models/index.js";
import { getLists } from "../services/list.js";
import { getMountainsOnList } from "../services/mountain.js";
import { getTrailsOnList } from "../services/trail.js";

describe("completion ownership in public reads", () => {
  it("omits completion fields from anonymous list responses", async () => {
    const lists = await getLists({});

    for (const list of lists) {
      expect(list).not.toHaveProperty("completedCount");
      expect(list).not.toHaveProperty("completedDate");
      expect(list).not.toHaveProperty("completions");
    }
  });

  it("does not include completion relations in anonymous list details", async () => {
    const list = await List.findOne();
    if (!list) return;

    const mountains = await getMountainsOnList(list.id);
    const trails = await getTrailsOnList(list.id);

    expect(mountains.every((mountain) => !mountain.Summits?.length)).toBe(true);
    expect(trails.every((trail) => !trail.TrailCompletions?.length)).toBe(true);
  });

  it("returns a completion only to its owner", async () => {
    const link = await MountainList.findOne();
    if (!link) return;

    const owner = await User.create({
      name: "Completion Owner",
      email: `completion-owner-${Date.now()}@example.test`,
      password: "",
    });
    const otherUser = await User.create({
      name: "Other User",
      email: `completion-other-${Date.now()}@example.test`,
      password: "",
    });
    const adventure = await Adventure.create({
      name: "Owned completion",
      userId: owner.id,
      activityId: null,
      activityDate: new Date("2026-01-01"),
    });
    await Summit.create({
      userId: owner.id,
      adventureId: adventure.id,
      mountainId: link.mountainId,
      completedAt: new Date("2026-01-01"),
    });

    const ownerLists = await getLists({}, owner.id);
    const otherLists = await getLists({}, otherUser.id);
    const ownerList = ownerLists.find((list) => list.id === link.listId);
    const otherList = otherLists.find((list) => list.id === link.listId);

    expect(ownerList?.completedCount).toBeGreaterThan(0);
    expect(otherList?.completedCount).toBe(0);

    await Summit.destroy({ where: { adventureId: adventure.id } });
    await adventure.destroy();
    await owner.destroy();
    await otherUser.destroy();
  });
});
