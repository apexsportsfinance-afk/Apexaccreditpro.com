const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = "https://dixelomafeobabahqeqg.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRpeGVsb21hZmVvYmFiYWhxZXFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzMzA4MzYsImV4cCI6MjA4NjkwNjgzNn0.YD1lj0T6kFoM2XyeYonIC3bmLiPkKBvmXEHEr5VMaGM";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function test() {
  console.log("Testing Supabase connection for project: dixelomafeobabahqeqg");
  
  try {
    const { data, error, count } = await supabase
      .from('events')
      .select('*', { count: 'exact', head: true });
    
    if (error) {
      console.error("Supabase Error:", error);
    } else {
      console.log("Connection Success!");
      console.log("Total Events Count:", count);
    }

    const { data: accData, error: accError, count: accCount } = await supabase
      .from('accreditations')
      .select('*', { count: 'exact', head: true });

    if (accError) {
      console.error("Accreditations Error:", accError);
    } else {
      console.log("Total Accreditations Count:", accCount);
    }

  } catch (err) {
    console.error("Critical Failure:", err);
  }
}

test();
