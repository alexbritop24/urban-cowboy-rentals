import type { Session, User } from "@supabase/supabase-js";

import { supabase } from "../lib/supabase";

export const STAFF_ROLES = ["staff", "admin"] as const;

export type StaffRole = (typeof STAFF_ROLES)[number];

export interface StaffAuthorization {
  authorized: boolean;
  role: StaffRole | null;
  session: Session | null;
}

const isStaffRole = (value: unknown): value is StaffRole =>
  typeof value === "string" && STAFF_ROLES.includes(value as StaffRole);

export const getTrustedStaffRole = (
  user: Pick<User, "app_metadata"> | null | undefined
): StaffRole | null => {
  const appMetadata = user?.app_metadata;
  if (!appMetadata || typeof appMetadata !== "object") return null;

  const role = appMetadata.role ?? appMetadata.app_role;
  return isStaffRole(role) ? role : null;
};

export const authorizeStaffSession = (
  session: Session | null
): StaffAuthorization => {
  const role = getTrustedStaffRole(session?.user);
  return { authorized: role !== null, role, session };
};

export const getCurrentStaffAuthorization = async (): Promise<StaffAuthorization> => {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return authorizeStaffSession(data.session);
};
