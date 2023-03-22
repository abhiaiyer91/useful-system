import { createClient } from "@supabase/supabase-js";

import { PermissionsSystem } from "./";

const supabase = createClient(
  "https://tsiddebqgokuesfocrti.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRzaWRkZWJxZ29rdWVzZm9jcnRpIiwicm9sZSI6ImFub24iLCJpYXQiOjE2NzkyNjI5MTAsImV4cCI6MTk5NDgzODkxMH0.OKEN7AXSxGvwNqebuPq9mE5XFAq574iOm9Aqm_ytcx0"
);

const system = new PermissionsSystem({
  db: supabase,
});

const USER_ID = `USER_ID`;
const PROJECT_ID = `PROJECT_ID`;

describe("PermissionsSystem", () => {
  afterAll(async () => {
    await system.deletePermission({
      resource_id: PROJECT_ID,
      user_id: USER_ID,
    });
  });

  it("upsertPermissions", async () => {
    const permission = await system.upsertPermissions({
      user_id: USER_ID,
      resource_id: PROJECT_ID,
      resource_type: `PROJECT`,
      can_read: true,
      can_write: true,
    });

    expect(permission.user_id).toBe(USER_ID);
    expect(permission.resource_id).toBe(PROJECT_ID);
  });

  it("getPermission", async () => {
    const permission = await system.getPermission({
      user_id: USER_ID,
      resource_id: PROJECT_ID,
    });

    expect(permission.user_id).toBe(USER_ID);
    expect(permission.resource_id).toBe(PROJECT_ID);
  });

  it("can", async () => {
    const canRead = await system.can({
      user_id: USER_ID,
      resource_id: PROJECT_ID,
      permission: `can_read`,
    });

    expect(canRead).toBe(true);

    const canWrite = await system.can({
      user_id: USER_ID,
      resource_id: PROJECT_ID,
      permission: `can_write`,
    });
    expect(canWrite).toBe(true);
  });

  it("getResourcesForUser", async () => {
    const resources = await system.getResourcesForUser({
      user_id: USER_ID,
    });

    expect(resources.length).toBe(1);
  });

  it("getResourcesForUserByResourceType", async () => {
    const resources = await system.getResourcesForUserByResourceType({
      user_id: USER_ID,
      resource_type: `PROJECT`,
    });

    expect(resources.length).toBe(1);
  });
});
