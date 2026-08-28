import { Sequelize } from "sequelize";

// Agent models
import { Session, initSession } from "./Session.js";
import { Message, initMessage } from "./Message.js";
import { Summary, initSummary } from "./Summary.js";

// User models
import { User, initUser } from "./User.js";

// Data models
import { State, initState } from "./State.js";

// List models
import { Mountain, initMountain } from "./Mountain.js";
import { Trail, initTrail } from "./Trail.js";
import { List, initList } from "./List.js";
import { MountainList, initMountainList } from "./MountainList.js";
import { TrailList, initTrailList } from "./TrailList.js";

// Adventure models
import { Activity, initActivity } from "./Activity.js";
import { Adventure, initAdventure } from "./Adventure.js";
import { Summit, initSummit } from "./Summit.js";
import { TrailCompletion, initTrailCompletion } from "./TrailCompletion.js";

const models = {
  State,
  Session,
  Message,
  Summary,
  User,
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

export {
  State,
  Session,
  Message,
  Summary,
  User,
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

  initUser(sequelize);

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

  Object.values(models).forEach((model: any) => {
    if (typeof model.associate === "function") {
      model.associate(models);
    }
  });
}
