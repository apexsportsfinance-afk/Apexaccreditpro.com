// Pure, dependency-free authorization logic extracted from AuthContext so it
// can be unit-tested in isolation. AuthContext delegates to these functions —
// behavior is identical to the previous inline implementation.

export type Role = "super_admin" | "admin" | "event_admin" | "viewer" | (string & {});

export const ROLE_PERMISSIONS: Record<string, string[]> = {
  super_admin: ["all"],
  admin: ["all"],
  event_admin: ["view_events", "manage_accreditations", "view_reports"],
  viewer: ["view_events", "view_accreditations"],
};

const isFullAdmin = (role: Role): boolean => role === "super_admin" || role === "admin";

export function hasPermission(role: Role | null | undefined, permission: string): boolean {
  if (!role) return false;
  const userPermissions = ROLE_PERMISSIONS[role] || [];
  return userPermissions.includes("all") || userPermissions.includes(permission);
}

export function canAccessEvent(
  role: Role | null | undefined,
  allowedEventIds: string[] | null | undefined,
  eventId: string
): boolean {
  if (!role) return false;
  if (isFullAdmin(role)) return true;
  if (!allowedEventIds) return false;
  return allowedEventIds.includes(eventId);
}

export function canAccessModule(
  role: Role | null | undefined,
  allowedModules: string[] | null | undefined,
  hasTeamAccess: boolean | null | undefined,
  path: string
): boolean {
  if (!role) return false;
  if (isFullAdmin(role)) return true;

  // Team Portal is only relevant once an admin has assigned the user to a team
  // (it has its own API-level security and RLS checks beyond this).
  if (path.startsWith("/portal/teams")) return !!hasTeamAccess;

  if (!allowedModules) return false;

  // Exact match, parent match, or child match.
  return allowedModules.some((modulePath) => {
    if (
      path === modulePath ||
      path.startsWith(modulePath + "/") ||
      modulePath.startsWith(path + "/")
    ) {
      return true;
    }

    // Special case for dynamic event routes like /admin/events/:id
    if (modulePath.startsWith("/admin/events/") && path.startsWith("/admin/events/")) {
      const pathParts = path.split("/"); // ["", "admin", "events", "uuid", "subpage?"]
      const modParts = modulePath.split("/"); // ["", "admin", "events", "audit-log"]

      // Allow access to the event detail wrapper
      if (pathParts.length === 4) return true;

      // Allow access to the specific granular subpage
      if (pathParts.length === 5 && pathParts[4] === modParts[3]) {
        return true;
      }
    }

    return false;
  });
}

export function hasExactModuleAccess(
  role: Role | null | undefined,
  allowedModules: string[] | null | undefined,
  path: string
): boolean {
  if (!role) return false;
  if (isFullAdmin(role)) return true;
  if (!allowedModules) return false;

  // Must exactly match or be a parent of the path.
  return allowedModules.some(
    (modulePath) => path === modulePath || path.startsWith(modulePath + "/")
  );
}
