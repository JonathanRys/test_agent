import { Sequelize } from "sequelize";
import { Session, initSession } from "./Session.js";
import { Message, initMessage } from "./Message.js";
import { Summary, initSummary } from "./Summary.js";

export { Session, Message, Summary };

export function initializeModels(sequelize: Sequelize): void {
  initSession(sequelize);
  initMessage(sequelize);
  initSummary(sequelize);

  // Define associations
  Session.hasMany(Message, { foreignKey: "sessionId" });
  Message.belongsTo(Session, { foreignKey: "sessionId" });

  Message.hasMany(Summary, { foreignKey: "userMessageId" });
  Summary.belongsTo(Message, { foreignKey: "userMessageId" });

  Message.hasMany(Summary, { foreignKey: "assistantMessageId" });
  Summary.belongsTo(Message, { foreignKey: "assistantMessageId" });
}
