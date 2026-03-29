import { createClient } from "@supabase/supabase-js";

export const supabaseUrl = "https://dixelomafeobabahqeqg.supabase.co";
export const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRpeGVsb21hZmVvYmFiYWhxZXFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzMzA4MzYsImV4cCI6MjA4NjkwNjgzNn0.YD1lj0T6kFoM2XyeYonIC3bmLiPkKBvmXEHEr5VMaGM";

const baseSupabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * APX-P0: Anti-Injection Proxy Shield
 * intercepts direct Supabase calls and blocks the "+1k/sec dummy record" patterns at the source.
 */
export const supabase = new Proxy(baseSupabase, {
  get(target, prop) {
    if (prop === 'from') {
      return (tableName) => {
        const queryBuilder = target.from(tableName);
        
        if (tableName === 'accreditations') {
          // Intercept insert and upsert
          const originalInsert = queryBuilder.insert;
          const originalUpsert = queryBuilder.upsert;

          queryBuilder.insert = (values, options) => {
            const data = Array.isArray(values) ? values : [values];
            for (const row of data) {
              const strRow = JSON.stringify(row);
              // APX-P0: Hard block known injection patterns using Regex
              // Covers Club_0...Club_99, first names starting with sxczcx, and mcczxvor domain
              const isInjection = /Club_\d+/i.test(strRow) || 
                                 /sxczcx/i.test(strRow) || 
                                 /mcczxvor/i.test(strRow) ||
                                 /ROLE_\d+/i.test(strRow);

              if (isInjection) {
                console.error("APX-P0: Injection Blocked!", row);
                return Promise.resolve({ data: null, error: { message: "INJECTION_BLOCKED", code: "APX-P0" } });
              }
            }
            return originalInsert.apply(queryBuilder, [values, options]);
          };

          queryBuilder.upsert = (values, options) => {
            const data = Array.isArray(values) ? values : [values];
            for (const row of data) {
              const strRow = JSON.stringify(row);
              const isInjection = /Club_\d+/i.test(strRow) || 
                                 /sxczcx/i.test(strRow) || 
                                 /mcczxvor/i.test(strRow) ||
                                 /ROLE_\d+/i.test(strRow);

              if (isInjection) {
                console.error("APX-P0: Injection Blocked (Upsert)!", row);
                return Promise.resolve({ data: null, error: { message: "INJECTION_BLOCKED", code: "APX-P0" } });
              }
            }
            return originalUpsert.apply(queryBuilder, [values, options]);
          };

        }
        
        return queryBuilder;
      };
    }
    return target[prop];
  }
});

