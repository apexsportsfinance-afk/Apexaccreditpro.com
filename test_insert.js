
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://dixelomafeobabahqeqg.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRpeGVsb21hZmVvYmFiYWhxZXFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzMzA4MzYsImV4cCI6MjA4NjkwNjgzNn0.YD1lj0T6kFoM2XyeYonIC3bmLiPkKBvmXEHEr5VMaGM';

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const { data, error } = await supabase
    .from('event_attendance')
    .insert([{
      event_id: '7694bb52-55bd-499d-b128-8904b7dc2c70',
      athlete_id: '3ee69442-8e4c-4ada-af3d-66108c51a487',
      scanner_location: 'X2',
      check_in_date: '2026-05-13',
      check_in_time: new Date().toISOString(),
      scan_count: 1,
      punctuality_status: 'UNASSIGNED'
    }])
    .select();

  if (error) {
    console.error('Insert Error:', error);
  } else {
    console.log('Insert Success:', data);
  }
}

test();
