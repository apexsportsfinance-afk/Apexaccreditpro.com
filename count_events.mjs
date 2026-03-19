import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://dixelomafeobabahqeqg.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRpeGVsb21hZmVvYmFiYWhxZXFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzMzA4MzYsImV4cCI6MjA4NjkwNjgzNn0.YD1lj0T6kFoM2XyeYonIC3bmLiPkKBvmXEHEr5VMaGM";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function countEvents() {
  const { count, error } = await supabase
    .from('athlete_events')
    .select('*', { count: 'exact', head: true });
    
  console.log("Total events in database:", count);
}

countEvents();
