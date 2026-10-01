import { env } from "./env.js";

export function isAdminEmail(email: string): boolean {
  const admins = env.ADMIN_USERS.split(";")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  return admins.includes(email.trim().toLowerCase());
}