import { Adventure } from "../models/index.js";

export const completionInclude = {
  model: Adventure,
  attributes: ["id", "name", "activityDate"],
};
