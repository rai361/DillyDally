import { User } from "@supabase/supabase-js";

export function isAdmin(user: User) {
    return user.app_metadata.is_admin;
}