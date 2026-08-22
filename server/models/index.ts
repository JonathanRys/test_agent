import { Sequelize } from "sequelize";
import { Session, initSession } from "./Session.js";
import { Message, initMessage } from "./Message.js";
import { Summary, initSummary } from "./Summary.js";

import { Mountain, initMountain } from "./Mountain.js";
import { Trail, initTrail } from "./Trail.js";
import { List, initList } from "./List.js";
import { MountainList, initMountainList } from "./MountainList.js";
import { TrailList, initTrailList } from "./TrailList.js";

export {
  Session,
  Message,
  Summary,
  Mountain,
  Trail,
  List,
  MountainList,
  TrailList,
};

export function initializeModels(sequelize: Sequelize): void {
  initSession(sequelize);
  initMessage(sequelize);
  initSummary(sequelize);

  initMountain(sequelize);
  initTrail(sequelize);
  initList(sequelize);
  initMountainList(sequelize);
  initTrailList(sequelize);

  // Define associations
  Session.hasMany(Message, { foreignKey: "sessionId" });
  Message.belongsTo(Session, { foreignKey: "sessionId" });

  Message.hasMany(Summary, { foreignKey: "userMessageId" });
  Summary.belongsTo(Message, { foreignKey: "userMessageId" });

  Message.hasMany(Summary, { foreignKey: "assistantMessageId" });
  Summary.belongsTo(Message, { foreignKey: "assistantMessageId" });

  Mountain.belongsToMany(List, {
    through: MountainList,
    foreignKey: "mountainId",
    otherKey: "listId",
  });

  // Mountain.belongsToMany(List, {
  //   as: "FilterList",
  //   through: MountainList,
  //   foreignKey: "mountainId",
  //   otherKey: "listId",
  // });

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
}
