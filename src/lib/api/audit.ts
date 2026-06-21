import { supabase } from "../supabase";
import { handleResponse } from "../apiHelpers";

export interface AuditLogEntry {
  id: string;
  action: string;
  details: unknown;
  timestamp: string;
  userId: string;
  userName: string;
}

export const AuditAPI = {
  log: (action: string, details?: unknown): void => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      supabase.from("audit_logs").insert([{
        action,
        details,
        user_id: session?.user?.id || "system",
        user_name: session?.user?.email || "System",
        timestamp: new Date().toISOString()
      }]).then(() => {}, () => {});
    });
  },
  getRecent: async (limit = 100, offset = 0): Promise<AuditLogEntry[]> => {
    const data = await handleResponse(
      () => supabase
        .from("audit_logs")
        .select("*")
        .order("timestamp", { ascending: false })
        .range(offset, offset + limit - 1)
    );
    return (data || []).map((r: Record<string, any>) => ({
      id: r.id,
      action: r.action,
      details: r.details,
      timestamp: r.timestamp,
      userId: r.user_id,
      userName: r.user_name
    }));
  },
  getScannerRecent: async (limit = 100): Promise<Record<string, any>[]> => {
    const data = await handleResponse(
      () => supabase
        .from("scanner_logs")
        .select(`
          *,
          accreditations (id, first_name, last_name, club, role, badge_number),
          spectator_orders (id, customer_name)
        `)
        .order("created_at", { ascending: false })
        .limit(limit)
    );
    return data || [];
  }
};
