import { sequelize, ensureInitialized } from "../utils/db.js";
import { Adventure, Summit, TrailCompletion } from "../models/index.js";
import {
  CreateAdventureInput,
  DeleteAdventureInput,
  EditAdventureInput,
} from "./types.js";

export async function createAdventure(
  input: CreateAdventureInput,
): Promise<Adventure> {
  await ensureInitialized();

  const activityDate = new Date(input.activityDate);
  const mountainIds = input.mountainIds ?? [];
  const trailIds = input.trailIds ?? [];

  return sequelize.transaction(async (transaction) => {
    const adventure = await Adventure.create(
      {
        name: input.name,
        userId: 1, // TODO: derive userId from session
        activityId: input.activityId,
        activityDate,
      },
      { transaction },
    );

    if (mountainIds.length > 0) {
      await Summit.bulkCreate(
        mountainIds.map((mountainId) => ({
          userId: 1, // TODO: derive userId from session
          adventureId: adventure.id,
          mountainId,
          completedAt: activityDate,
        })),
        { transaction },
      );
    }

    if (trailIds.length > 0) {
      await TrailCompletion.bulkCreate(
        trailIds.map((trailId) => ({
          userId: 1, // TODO: derive userId from session
          adventureId: adventure.id,
          trailId,
          completedAt: activityDate,
        })),
        { transaction },
      );
    }

    return adventure;
  });
}

export async function editAdventure(
  input: EditAdventureInput,
): Promise<{ affectedCount: number[]; adventure: Adventure | null }> {
  await ensureInitialized();

  const activityDate = new Date(input.activityDate);
  const mountainId = input.mountainId ?? null;
  const trailId = input.trailId ?? null;
  const activityId = input.activityId ?? null;

  return sequelize.transaction(async (transaction) => {
    const adventure = await Adventure.findByPk(input.id);

    const affectedCount = await Adventure.update(
      { activityDate, activityId },
      {
        where: {
          id: input.id,
        },
        transaction,
      },
    );

    if (mountainId) {
      await Summit.update(
        {
          completedAt: activityDate,
        },
        {
          where: {
            adventureId: input.id,
            mountainId,
          },
          transaction,
        },
      );
    }

    if (trailId) {
      await TrailCompletion.update(
        {
          completedAt: activityDate,
        },
        {
          where: {
            adventureId: input.id,
            trailId,
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
): Promise<{ affectedCount: number; adventure: Adventure | null }> {
  await ensureInitialized();

  const mountainId = input.mountainId ?? null;
  const trailId = input.trailId ?? null;

  return sequelize.transaction(async (transaction) => {
    const adventure = await Adventure.findByPk(input.id);

    const affectedCount = await Adventure.destroy({
      where: {
        id: input.id,
      },
      transaction,
    });

    if (mountainId) {
      await Summit.destroy({
        where: {
          adventureId: input.id,
          mountainId,
        },
        transaction,
      });
    }

    if (trailId) {
      await TrailCompletion.destroy({
        where: {
          adventureId: input.id,
          trailId,
        },
        transaction,
      });
    }

    return { affectedCount, adventure };
  });
}
