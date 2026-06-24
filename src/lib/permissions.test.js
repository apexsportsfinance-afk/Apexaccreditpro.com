import { describe, it, expect } from "vitest";
import {
  hasPermission,
  canAccessEvent,
  canAccessModule,
  hasExactModuleAccess,
} from "./permissions";

describe("hasPermission", () => {
  it("grants everything to super_admin and admin", () => {
    expect(hasPermission("super_admin", "anything")).toBe(true);
    expect(hasPermission("admin", "delete_everything")).toBe(true);
  });

  it("scopes event_admin to its allowed actions", () => {
    expect(hasPermission("event_admin", "manage_accreditations")).toBe(true);
    expect(hasPermission("event_admin", "view_reports")).toBe(true);
    expect(hasPermission("event_admin", "delete_users")).toBe(false);
  });

  it("scopes viewer to read-only actions", () => {
    expect(hasPermission("viewer", "view_events")).toBe(true);
    expect(hasPermission("viewer", "manage_accreditations")).toBe(false);
  });

  it("denies when role is missing or unknown", () => {
    expect(hasPermission(null, "view_events")).toBe(false);
    expect(hasPermission(undefined, "view_events")).toBe(false);
    expect(hasPermission("ghost_role", "view_events")).toBe(false);
  });
});

describe("canAccessEvent", () => {
  it("lets full admins access any event", () => {
    expect(canAccessEvent("super_admin", null, "evt-1")).toBe(true);
    expect(canAccessEvent("admin", [], "evt-1")).toBe(true);
  });

  it("restricts event_admin to assigned events", () => {
    expect(canAccessEvent("event_admin", ["evt-1"], "evt-1")).toBe(true);
    expect(canAccessEvent("event_admin", ["evt-1"], "evt-2")).toBe(false);
    expect(canAccessEvent("event_admin", null, "evt-1")).toBe(false);
  });

  it("denies when role missing", () => {
    expect(canAccessEvent(null, ["evt-1"], "evt-1")).toBe(false);
  });
});

describe("canAccessModule", () => {
  it("lets full admins access any module", () => {
    expect(canAccessModule("admin", null, false, "/admin/anything")).toBe(true);
  });

  it("gates the team portal on hasTeamAccess", () => {
    expect(canAccessModule("viewer", [], true, "/portal/teams/123")).toBe(true);
    expect(canAccessModule("viewer", [], false, "/portal/teams/123")).toBe(false);
  });

  it("matches exact, parent, and child module paths", () => {
    expect(canAccessModule("viewer", ["/admin/users"], false, "/admin/users")).toBe(true);
    expect(canAccessModule("viewer", ["/admin/users"], false, "/admin/users/42")).toBe(true);
    expect(canAccessModule("viewer", ["/admin/users/list"], false, "/admin/users")).toBe(true);
    expect(canAccessModule("viewer", ["/admin/users"], false, "/admin/zones")).toBe(false);
  });

  it("handles dynamic /admin/events/:id routes", () => {
    const mods = ["/admin/events/audit-log"];
    expect(canAccessModule("viewer", mods, false, "/admin/events/uuid")).toBe(true); // wrapper
    expect(canAccessModule("viewer", mods, false, "/admin/events/uuid/audit-log")).toBe(true); // granular
    expect(canAccessModule("viewer", mods, false, "/admin/events/uuid/categories")).toBe(false);
  });

  it("denies when role missing or no modules", () => {
    expect(canAccessModule(null, ["/admin/users"], false, "/admin/users")).toBe(false);
    expect(canAccessModule("viewer", null, false, "/admin/users")).toBe(false);
  });
});

describe("hasExactModuleAccess", () => {
  it("requires exact or parent match (not child-only)", () => {
    expect(hasExactModuleAccess("viewer", ["/admin/users"], "/admin/users")).toBe(true);
    expect(hasExactModuleAccess("viewer", ["/admin/users"], "/admin/users/42")).toBe(true);
    expect(hasExactModuleAccess("viewer", ["/admin/users/list"], "/admin/users")).toBe(false);
  });

  it("lets full admins through", () => {
    expect(hasExactModuleAccess("super_admin", null, "/admin/users")).toBe(true);
  });

  it("denies when role missing", () => {
    expect(hasExactModuleAccess(null, ["/admin/users"], "/admin/users")).toBe(false);
  });
});
