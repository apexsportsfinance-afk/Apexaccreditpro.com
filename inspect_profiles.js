import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://dixelomafeobabahqeqg.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRpeGVsb21hZmVvYmFiYWhxZXFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzMzA4MzYsImV4cCI6MjA4NjkwNjgzNn0.YD1lj0T6kFoM2XyeYonIC3bmLiPkKBvmXEHEr5VMaGM';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function inspectProfiles() {
  console.log('--- Inspecting PROFILES Table ---');
  const { data, error } = await supabase.from('profiles').select('*');
  
  if (error) {
    console.error('Error fetching profiles:', error);
  } else {
    console.log(`Found ${data.length} profiles:`);
    data.forEach(p => {
      console.log(`- [${p.id}] ${p.email} | Name: ${p.full_name} | Role: ${p.role}`);
    });
  }
}

inspectProfiles();
