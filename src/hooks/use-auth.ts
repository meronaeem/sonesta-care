import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole =
  | "administrator"
  | "it_manager"
  | "it_supervisor"
  | "it_engineer"
  | "helpdesk"
  | "department_manager"
  | "employee";

export interface Profile {
  id: string;
  full_name: string | null;
  username: string | null;
  email: string | null;
  job_title: string | null;
}

const IT_ROLES: AppRole[] = [
  "administrator",
  "it_manager",
  "it_supervisor",
  "it_engineer",
  "helpdesk",
];

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const load = async (u: User | null) => {
      if (!u) {
        setProfile(null);
        setRoles([]);
        return;
      }
      const [{ data: p }, { data: r }] = await Promise.all([
        supabase.from("profiles").select("id,full_name,username,email,job_title").eq("id", u.id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", u.id),
      ]);
      if (!mounted) return;
      setProfile(p as Profile | null);
      setRoles((r ?? []).map((x: { role: AppRole }) => x.role));
    };

    supabase.auth.getUser().then(async ({ data }) => {
      if (!mounted) return;
      setUser(data.user);
      await load(data.user);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
      load(session?.user ?? null);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const hasRole = (role: AppRole) => roles.includes(role);
  const isIT = roles.some((r) => IT_ROLES.includes(r));
  const primaryRole: AppRole | null = roles[0] ?? null;

  return { user, profile, roles, primaryRole, isIT, hasRole, loading };
}