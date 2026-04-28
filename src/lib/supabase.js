import { createClient } from "@supabase/supabase-js";

export const supabaseUrl = "https://dixelomafeobabahqeqg.supabase.co";
export const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRpeGVsb21hZmVvYmFiYWhxZXFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzMzA4MzYsImV4cCI6MjA4NjkwNjgzNn0.YD1lj0T6kFoM2XyeYonIC3bmLiPkKBvmXEHEr5VMaGM";

const baseSupabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * APX-P0: Anti-Injection Proxy Shield (Optimized)
 * Only intercepts write operations (insert/upsert) on the accreditations table.
 * Read operations pass through with zero overhead.
 */
const INJECTION_PATTERN = /Club_\d+|sxczcx|mcczxvor|ROLE_\d+/i;

function createGuardedInsert(originalFn, queryBuilder) {
  return (values, options) => {
    const data = Array.isArray(values) ? values : [values];
    for (const row of data) {
      if (INJECTION_PATTERN.test(JSON.stringify(row))) {
        console.error("APX-P0: Injection Blocked!", row);
        return Promise.resolve({ data: null, error: { message: "INJECTION_BLOCKED", code: "APX-P0" } });
      }
    }
    return originalFn.apply(queryBuilder, [values, options]);
  };
}

export const supabase = new Proxy(baseSupabase, {
  get(target, prop) {
    if (prop === 'from') {
      return (tableName) => {
        const queryBuilder = target.from(tableName);
        
        // APX-PERF: Only intercept writes on accreditations table
        if (tableName === 'accreditations') {
          const originalInsert = queryBuilder.insert;
          const originalUpsert = queryBuilder.upsert;
          queryBuilder.insert = createGuardedInsert(originalInsert, queryBuilder);
          queryBuilder.upsert = createGuardedInsert(originalUpsert, queryBuilder);
        }
        
        return queryBuilder;
      };
    }
    return target[prop];
  }
});
