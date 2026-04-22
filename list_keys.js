import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://dixelomafeobabahqeqg.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRpeGVsb21hZmVvYmFiYWhxZXFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzMzA4MzYsImV4cCI6MjA4NjkwNjgzNn0.YD1lj0T6kFoM2XyeYonIC3bmLiPkKBvmXEHEr5VMaGM';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function listSettings() {
  console.log('Listing all keys in global_settings...');
  const { data, error } = await supabase.from('global_settings').select('key');
  if (error) {
    console.error('Error:', error);
  } else {
    data.forEach(row => console.log('Key:', row.key));
  }
}

listSettings();
