import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://dixelomafeobabahqeqg.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRpeGVsb21hZmVvYmFiYWhxZXFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzMzA4MzYsImV4cCI6MjA4NjkwNjgzNn0.YD1lj0T6kFoM2XyeYonIC3bmLiPkKBvmXEHEr5VMaGM";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function monitor() {
  const getCount = async () => {
    const { count } = await supabase
      .from('accreditations')
      .select('*', { count: 'exact', head: true });
    return count;
  };

  console.log("[MONITOR] Measuring injection rate...");
  const c1 = await getCount();
  const t1 = Date.now();
  
  await new Promise(r => setTimeout(r, 2000));
  
  const c2 = await getCount();
  const t2 = Date.now();
  
  const delta = c2 - c1;
  const time = (t2 - t1) / 1000;
  const rate = delta / time;
  
  console.log(`[MONITOR] Count 1: ${c1}`);
  console.log(`[MONITOR] Count 2: ${c2}`);
  console.log(`[MONITOR] Delta: ${delta}`);
  console.log(`[MONITOR] Rate: ${rate.toFixed(2)} records/sec`);
}

monitor();
