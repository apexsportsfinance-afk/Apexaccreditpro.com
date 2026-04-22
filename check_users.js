import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://dixelomafeobabahqeqg.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRpeGVsb21hZmVvYmFiYWhxZXFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzMzA4MzYsImV4cCI6MjA4NjkwNjgzNn0.YD1lj0T6kFoM2XyeYonIC3bmLiPkKBvmXEHEr5VMaGM';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkAccess() {
  console.log('Checking global_settings for user_event_access...');
  const { data: mapping, error: mapError } = await supabase
    .from('global_settings')
    .select('value')
    .eq('key', 'user_event_access')
    .maybeSingle();

  if (mapError) {
    console.error('Error fetching mapping:', mapError);
  } else {
    console.log('User Event Access Mapping:', mapping?.value);
  }

  console.log('\nChecking for any other user-like tables...');
  const tables = ['admins', 'user_roles', 'team', 'staff', 'members'];
  for (const table of tables) {
    const { data, error } = await supabase.from(table).select('count', { count: 'exact', head: true });
    if (!error) {
      console.log(`Table exists: ${table} (Count: ${data})`);
    } else if (error.code !== '42P01') { // 42P01 is "relation does not exist"
       console.log(`Table ${table} error:`, error.message);
    }
  }
}

checkAccess();
