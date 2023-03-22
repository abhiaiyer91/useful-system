import { SupabaseClient } from "@supabase/supabase-js";

export class PermissionsSystem {
  db: SupabaseClient;
  constructor({ db }: { db: SupabaseClient }) {
    this.db = db;
  }

  async upsertPermissions({
    resource_id,
    user_id,
    resource_type,
    can_read,
    can_write,
  }: {
    resource_id: string;
    resource_type: string;
    user_id: string;
    can_read: boolean;
    can_write: boolean;
  }) {
    const { data, error } = await this.db
      .from(`permissions`)
      .upsert({ user_id, resource_id, resource_type, can_read, can_write })
      .select("*")
      .limit(1);

    if (error) {
      throw error;
    }

    return data?.[0];
  }

  async getResourcesForUser({ user_id }: { user_id: string }) {
    const { data, error } = await this.db
      .from(`permissions`)
      .select("*")
      .eq("user_id", user_id);

    if (error) {
      throw error;
    }

    return data;
  }

  async getResourcesForUserByResourceType({
    user_id,
    resource_type,
  }: {
    user_id: string;
    resource_type: string;
  }) {
    const { data, error } = await this.db
      .from(`permissions`)
      .select("*")
      .eq("user_id", user_id)
      .eq("resource_type", resource_type);

    if (error) {
      throw error;
    }

    return data;
  }

  async getPermission({
    user_id,
    resource_id,
  }: {
    user_id: string;
    resource_id: string;
  }) {
    const { data, error } = await this.db
      .from(`permissions`)
      .select("*")
      .eq("user_id", user_id)
      .eq("resource_id", resource_id)
      .limit(1);

    if (error) {
      throw error;
    }

    return data?.[0];
  }

  async can({
    resource_id,
    user_id,
    permission,
  }: {
    resource_id: string;
    user_id: string;
    permission: `can_read` | `can_write`;
  }) {
    const perm = await this.getPermission({
      user_id,
      resource_id,
    });

    return perm?.[permission];
  }

  async deletePermission({
    user_id,
    resource_id,
  }: {
    user_id: string;
    resource_id: string;
  }) {
    const { error } = await this.db
      .from(`permissions`)
      .delete()
      .eq("user_id", user_id)
      .eq("resource_id", resource_id);

    if (error) {
      throw error;
    }
  }
}
