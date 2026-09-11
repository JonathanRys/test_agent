import { sequelize, ensureInitialized } from "../utils/db.js";
import { Adventure, Summit, TrailCompletion } from "../models/index.js";
import {
  CreateAdventureInput,
  DeleteAdventureInput,
  EditAdventureInput,
} from "./types.js";

export async function createAdventure(
  input: CreateAdventureInput,
  userId: number,
): Promise<Adventure> {
  await ensureInitialized();

  const activityDate = new Date(input.activityDate);
  const mountainIds = input.mountainIds ?? [];
  const trailIds = input.trailIds ?? [];

  return sequelize.transaction(async (transaction) => {
    const adventure = await Adventure.create(
      {
        name: input.name,
        activityId: input.activityId,
        userId,
        activityDate,
      },
      { transaction },
    );

    if (mountainIds.length > 0) {
      await Summit.bulkCreate(
        mountainIds.map((mountainId) => ({
          userId,
          adventureId: adventure.id,
          mountainId,
          completedAt: activityDate,
          season: input.season ?? null,
        })),
        {
          updateOnDuplicate: ["userId", "adventureId", "mountainId"],
          transaction,
        },
      );
    }

    if (trailIds.length > 0) {
      await TrailCompletion.bulkCreate(
        trailIds.map((trailId) => ({
          userId,
          adventureId: adventure.id,
          trailId,
          completedAt: activityDate,
          season: input.season ?? null,
        })),
        {
          updateOnDuplicate: ["userId", "adventureId", "trailId"],
          transaction,
        },
      );
    }

    return adventure;
  });
}

export async function editAdventure(
  input: EditAdventureInput,
  userId: number,
): Promise<{ affectedCount: number[]; adventure: Adventure | null }> {
  await ensureInitialized();

  const activityDate = new Date(input.activityDate);
  const mountainId = input.mountainId ?? null;
  const trailId = input.trailId ?? null;
  const activityId = input.activityId ?? null;
  const season = input.season ?? null;

  return sequelize.transaction(async (transaction) => {
    const adventure = await Adventure.findOne({
      where: { id: input.id, userId },
      transaction,
    });

    const affectedCount = await Adventure.update(
      { activityDate, activityId },
      {
        where: { id: input.id, userId },
        transaction,
      },
    );

    if (mountainId) {
      await Summit.update(
        {
          completedAt: activityDate,
          season,
        },
        {
          where: {
            adventureId: input.id,
            mountainId,
            userId,
          },
          transaction,
        },
      );
    }

    if (trailId) {
      await TrailCompletion.update(
        {
          completedAt: activityDate,
          season,
        },
        {
          where: {
            adventureId: input.id,
            trailId,
            userId,
          },
          transaction,
        },
      );
    }

    return { affectedCount, adventure };
  });
}

export async function deleteAdventure(
  input: DeleteAdventureInput,
  userId: number,
): Promise<{ affectedCount: number; adventure: Adventure | null }> {
  await ensureInitialized();

  const mountainId = input.mountainId ?? null;
  const trailId = input.trailId ?? null;

  return sequelize.transaction(async (transaction) => {
    const adventure = await Adventure.findOne({
      where: { id: input.id, userId },
      transaction,
    });

    const affectedCount = await Adventure.destroy({
      where: {
        id: input.id,
        userId,
      },
      transaction,
    });

    if (mountainId) {
      await Summit.destroy({
        where: {
          adventureId: input.id,
          mountainId,
          userId,
        },
        transaction,
      });
    }

    if (trailId) {
      await TrailCompletion.destroy({
        where: {
          adventureId: input.id,
          trailId,
          userId,
        },
        transaction,
      });
    }

    return { affectedCount, adventure };
  });
}
