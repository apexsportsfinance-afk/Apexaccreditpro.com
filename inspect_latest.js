import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://dixelomafeobabahqeqg.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRpeGVsb21hZmVvYmFiYWhxZXFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzMzA4MzYsImV4cCI6MjA4NjkwNjgzNn0.YD1lj0T6kFoM2XyeYonIC3bmLiPkKBvmXEHEr5VMaGM";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function inspect() {
  console.log("[FORENSIC] Fetching latest 10 records...");
  const { data, error } = await supabase
    .from('accreditations')
    .select('id, first_name, last_name, email, club, status, created_at')
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error("Error:", error);
    return;
  }

  console.log(JSON.stringify(data, null, 2));
}

inspect();
