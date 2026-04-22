import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://dixelomafeobabahqeqg.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRpeGVsb21hZmVvYmFiYWhxZXFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzMzA4MzYsImV4cCI6MjA4NjkwNjgzNn0.YD1lj0T6kFoM2XyeYonIC3bmLiPkKBvmXEHEr5VMaGM';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function tryListUsers() {
  const EDGE_URL = 'https://dixelomafeobabahqeqg.supabase.co/functions/v1/manage-users';
  console.log('Attempting to list users via edge function...');
  
  // Note: This usually requires a service role or a valid admin session.
  // Since I don't have a session here, it might fail, but let's see if there's any public info or if I can guess a param.
  try {
    const response = await fetch(EDGE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'list' })
    });
    const data = await response.json();
    console.log('List Users Response:', JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Edge Function call failed:', err.message);
  }
}

tryListUsers();
