import { sequelize, ensureInitialized } from "../utils/db.js";
import {
  Activity,
  Adventure,
  Summit,
  TrailCompletion,
} from "../models/index.js";
import {
  CreateAdventureInput,
  DeleteAdventureInput,
  EditAdventureInput,
} from "./types.js";
import { Op } from "sequelize";

export class DuplicateCompletionError extends Error {
  statusCode = 409;

  constructor(entity: "trail" | "summit") {
    super(`This ${entity} has already been completed on that date.`);
    this.name = "DuplicateCompletionError";
  }
}

const adventureIncludes = [
  { model: Activity },
  { model: Summit },
  { model: TrailCompletion },
];

export async function getAdventures(userId: number): Promise<Adventure[]> {
  await ensureInitialized();

  return Adventure.findAll({
    where: { userId },
    include: adventureIncludes,
    order: [["activityDate", "DESC"]],
  });
}

export async function getAdventure(
  id: number,
  userId: number,
): Promise<Adventure | null> {
  await ensureInitialized();

  return Adventure.findOne({
    where: { id, userId },
    include: adventureIncludes,
  });
}

export async function createAdventure(
  input: CreateAdventureInput,
  userId: number,
): Promise<Adventure> {
  await ensureInitialized();

  const activityDate = new Date(input.activityDate);
  const mountainIds = input.mountainIds ?? [];
  const trailIds = input.trailIds ?? [];

  return sequelize.transaction(async (transaction) => {
    const [existingSummit, existingTrail] = await Promise.all([
      mountainIds.length > 0
        ? Summit.findOne({
            where: {
              userId,
              mountainId: { [Op.in]: mountainIds },
              completedAt: activityDate,
            },
            transaction,
          })
        : null,
      trailIds.length > 0
        ? TrailCompletion.findOne({
            where: {
              userId,
              trailId: { [Op.in]: trailIds },
              completedAt: activityDate,
            },
            transaction,
          })
        : null,
    ]);

    if (existingSummit) throw new DuplicateCompletionError("summit");
    if (existingTrail) throw new DuplicateCompletionError("trail");

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
        { transaction },
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
        { transaction },
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

    if (mountainId) {
      const existingSummit = await Summit.findOne({
        where: {
          userId,
          mountainId,
          completedAt: activityDate,
          adventureId: { [Op.ne]: input.id },
        },
        transaction,
      });
      if (existingSummit) throw new DuplicateCompletionError("summit");
    }

    if (trailId) {
      const existingTrail = await TrailCompletion.findOne({
        where: {
          userId,
          trailId,
          completedAt: activityDate,
          adventureId: { [Op.ne]: input.id },
        },
        transaction,
      });
      if (existingTrail) throw new DuplicateCompletionError("trail");
    }

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
