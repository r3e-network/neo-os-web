/**
 * Role-Based Access Control hooks for Auth0
 */
import { useUser } from "@auth0/nextjs-auth0/client";

export type UserRole = "admin" | "user" | "guest";

export function useRole(): UserRole {
  const { user } = useUser();
  if (!user) return "guest";
  const roles = (user["https://neo-miniapp.com/roles"] as string[]) || [];
  if (roles.includes("admin")) return "admin";
  return "user";
}

export function useHasRole(role: UserRole): boolean {
  const currentRole = useRole();
  const hierarchy: Record<UserRole, number> = { admin: 3, user: 2, guest: 1 };
  return hierarchy[currentRole] >= hierarchy[role];
}
