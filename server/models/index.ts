import { Sequelize } from "sequelize";
import { Session, initSession } from "./Session.js";
import { Message, initMessage } from "./Message.js";
import { Summary, initSummary } from "./Summary.js";

import { State, initState } from "./State.js";
import { Mountain, initMountain } from "./Mountain.js";
import { Trail, initTrail } from "./Trail.js";
import { List, initList } from "./List.js";
import { MountainList, initMountainList } from "./MountainList.js";
import { TrailList, initTrailList } from "./TrailList.js";
import { Activity, initActivity } from "./Activity.js";
import { Adventure, initAdventure } from "./Adventure.js";
import { Summit, initSummit } from "./Summit.js";
import { TrailCompletion, initTrailCompletion } from "./TrailCompletion.js";

export {
  State,
  Session,
  Message,
  Summary,
  Mountain,
  Trail,
  List,
  MountainList,
  TrailList,
  Activity,
  Adventure,
  Summit,
  TrailCompletion,
};

export function initializeModels(sequelize: Sequelize): void {
  initSession(sequelize);
  initMessage(sequelize);
  initSummary(sequelize);

  initState(sequelize);
  initMountain(sequelize);
  initTrail(sequelize);
  initList(sequelize);
  initMountainList(sequelize);
  initTrailList(sequelize);
  initActivity(sequelize);
  initAdventure(sequelize);
  initSummit(sequelize);
  initTrailCompletion(sequelize);

  // Define associations
  Session.hasMany(Message, { foreignKey: "sessionId" });
  Message.belongsTo(Session, { foreignKey: "sessionId" });

  Message.hasMany(Summary, { foreignKey: "userMessageId" });
  Summary.belongsTo(Message, { foreignKey: "userMessageId" });

  Message.hasMany(Summary, { foreignKey: "assistantMessageId" });
  Summary.belongsTo(Message, { foreignKey: "assistantMessageId" });

  State.hasMany(Mountain, { foreignKey: "stateId" });
  Mountain.belongsTo(State, { foreignKey: "stateId", as: "state" });

  State.hasMany(Trail, { foreignKey: "stateId" });
  Trail.belongsTo(State, { foreignKey: "stateId", as: "state" });

  Mountain.belongsToMany(List, {
    through: MountainList,
    foreignKey: "mountainId",
    otherKey: "listId",
  });

  List.belongsToMany(Mountain, {
    through: MountainList,
    foreignKey: "listId",
    otherKey: "mountainId",
  });

  Trail.belongsToMany(List, {
    through: TrailList,
    foreignKey: "trailId",
    otherKey: "listId",
  });

  List.belongsToMany(Trail, {
    through: TrailList,
    foreignKey: "listId",
    otherKey: "trailId",
  });

  Activity.hasMany(Activity, {
    foreignKey: "parentActivity",
    as: "children",
  });
  Activity.belongsTo(Activity, {
    foreignKey: "parentActivity",
    as: "parent",
  });

  Activity.hasMany(Adventure, { foreignKey: "activityId" });
  Adventure.belongsTo(Activity, { foreignKey: "activityId" });

  Adventure.hasMany(Summit, { foreignKey: "adventureId" });
  Summit.belongsTo(Adventure, { foreignKey: "adventureId" });

  Adventure.hasMany(TrailCompletion, { foreignKey: "adventureId" });
  TrailCompletion.belongsTo(Adventure, { foreignKey: "adventureId" });

  Mountain.hasMany(Summit, { foreignKey: "mountainId" });
  Summit.belongsTo(Mountain, { foreignKey: "mountainId" });

  Trail.hasMany(TrailCompletion, { foreignKey: "trailId" });
  TrailCompletion.belongsTo(Trail, { foreignKey: "trailId" });
}
