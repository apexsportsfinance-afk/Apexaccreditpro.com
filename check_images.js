import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://dixelomafeobabahqeqg.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRpeGVsb21hZmVvYmFiYWhxZXFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzMzA4MzYsImV4cCI6MjA4NjkwNjgzNn0.YD1lj0T6kFoM2XyeYonIC3bmLiPkKBvmXEHEr5VMaGM";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkEventImages() {
  const { data, error } = await supabase.from('events').select('id, name, logo_url, back_template_url, sponsor_logos');
  if (error) {
    console.error("Error:", error);
  } else {
    data.forEach(e => {
      console.log(`Event: ${e.name}`);
      console.log(`  logo_url length: ${e.logo_url ? e.logo_url.length : 0}`);
      console.log(`  back_template_url length: ${e.back_template_url ? e.back_template_url.length : 0}`);
      console.log(`  sponsor_logos count: ${e.sponsor_logos ? e.sponsor_logos.length : 0}`);
    });
  }
}
checkEventImages();
