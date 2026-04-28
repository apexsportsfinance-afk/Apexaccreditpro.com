import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://dixelomafeobabahqeqg.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRpeGVsb21hZmVvYmFiYWhxZXFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzMzA4MzYsImV4cCI6MjA4NjkwNjgzNn0.YD1lj0T6kFoM2XyeYonIC3bmLiPkKBvmXEHEr5VMaGM';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function auditData() {
  console.log('--- Auditing User Event Access Data ---');
  
  const { data: profileData } = await supabase.from('profiles').select('id, email, role');
  console.log('\nProfiles:');
  profileData.forEach(p => console.log(`- [${p.id}] ${p.email} (${p.role})`));

  const { data: settingsData } = await supabase.from('global_settings').select('key, value');
  console.log('\nGlobal Settings:');
  settingsData.forEach(s => {
    if (s.key === 'user_event_access' || s.key === 'user_module_access') {
      console.log(`- Key: ${s.key}`);
      console.log(`  Value: ${s.value}`);
    }
  });

  const { data: eventsData } = await supabase.from('events').select('id, name');
  console.log('\nEvents:');
  eventsData.forEach(e => console.log(`- [${e.id}] ${e.name}`));
}

auditData();
