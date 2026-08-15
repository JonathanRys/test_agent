import { Sequelize } from "sequelize";
import { Session, initSession } from "./Session.js";
import { Message, initMessage } from "./Message.js";

export { Session, Message };

export function initializeModels(sequelize: Sequelize): void {
  initSession(sequelize);
  initMessage(sequelize);

  // Define associations
  Session.hasMany(Message, { foreignKey: "sessionId" });
  Message.belongsTo(Session, { foreignKey: "sessionId" });
}
