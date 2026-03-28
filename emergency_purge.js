import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://dixelomafeobabahqeqg.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRpeGVsb21hZmVvYmFiYWhxZXFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzMzA4MzYsImV4cCI6MjA4NjkwNjgzNn0.YD1lj0T6kFoM2XyeYonIC3bmLiPkKBvmXEHEr5VMaGM";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function purge() {
  console.log("[PURGE] Starting STABLE ID-Based Chunked Purge (500 row batches)...");
  
  let totalDeleted = 180000; // Approximated from logs
  let running = true;
   const BATCH_SIZE = 6000; // APX-P0: Set to 6k to match dashboard capacity

  while (running) {
    try {
      // 1. Fetch 500 IDs to delete
    // Broad filters to catch all variations (Club_1, Club_2, etc.)
    // We order by created_at DESC to clear the "Recent" list first for visual verification
    const { data, error } = await supabase
      .from('accreditations')
      .select('id')
      .or('email.ilike.%mcczxvor.com%,club.ilike.Club_%,first_name.ilike.sxczcx%')
      .order('created_at', { ascending: false })
      .limit(BATCH_SIZE);

      if (error) { // Changed from fetchError to error
        console.error("[PURGE] Fetch Error:", error.message); // Changed from fetchError to error
        await new Promise(r => setTimeout(r, 5000));
        continue;
      }

      if (!data || data.length === 0) {
        console.log("[PURGE] No more matches found. Verifying final count...");
        const { count } = await supabase
          .from('accreditations')
          .select('*', { count: 'exact', head: true })
          .or('email.ilike.%mcczxvor.com%,club.ilike.Club_%,first_name.ilike.sxczcx%');
        
        if (count === 0) {
           console.log("[PURGE] DATABASE IS CLEAN.");
           running = false;
           break;
        }
        await new Promise(r => setTimeout(r, 2000));
        continue;
      }

      const idsToDelete = data.map(r => r.id);
      
      // 2. Bulk Delete (Sub-batched for POST stability)
      for (let i = 0; i < idsToDelete.length; i += 1000) {
        const subBatch = idsToDelete.slice(i, i + 1000);
        const { error: deleteError, count: deletedCount } = await supabase
          .from('accreditations')
          .delete()
          .in('id', subBatch);

        if (deleteError) {
          console.error(`[PURGE] Delete Error for sub-batch starting at ${i}:`, deleteError.message);
        } else {
          totalDeleted += subBatch.length;
        }
      }

      console.log(`[PURGE] Progress: ${totalDeleted} records purged. Est Remaining: ${Math.max(0, 500000 - totalDeleted)}`);
      await new Promise(r => setTimeout(r, 100)); // Minimal throttle for high velocity

    } catch (err) {
      console.error("[PURGE] Unexpected Error:", err);
      await new Promise(r => setTimeout(r, 5000));
    }
  }
}

purge();
