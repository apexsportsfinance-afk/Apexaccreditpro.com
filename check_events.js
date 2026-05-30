import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://dixelomafeobabahqeqg.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRpeGVsb21hZmVvYmFiYWhxZXFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzMzA4MzYsImV4cCI6MjA4NjkwNjgzNn0.YD1lj0T6kFoM2XyeYonIC3bmLiPkKBvmXEHEr5VMaGM";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkEvents() {
  const { data, error } = await supabase.from('events').select('*').limit(1);
  if (error) {
    console.error("Error:", error);
  } else if (data.length > 0) {
    console.log("Event columns:", Object.keys(data[0]));
  } else {
    console.log("No events found, but queried successfully.");
  }
}
checkEvents();
