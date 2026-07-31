import { execute as stealExecute } from "./steal.js";

export const name = "rob";
export const description = "Alias for !steal \u2014 attempt to rob another user";
export const usage = "!rob @user";
export const category = "economy";

export async function execute(message, args) {
  return stealExecute(message, args);
}
