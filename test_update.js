
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://dixelomafeobabahqeqg.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRpeGVsb21hZmVvYmFiYWhxZXFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzMzA4MzYsImV4cCI6MjA4NjkwNjgzNn0.YD1lj0T6kFoM2XyeYonIC3bmLiPkKBvmXEHEr5VMaGM';

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  // First, get the record to be sure
  const { data: existing } = await supabase
    .from('event_attendance')
    .select('*')
    .eq('id', 6101)
    .single();

  console.log('Current Record:', existing);

  const { data, error } = await supabase
    .from('event_attendance')
    .update({ 
      scanner_location: 'Mobile-Self-Scan, A1',
      scan_count: (existing.scan_count || 0) + 1
    })
    .eq('id', 6101)
    .select();

  if (error) {
    console.error('Update Error:', error);
  } else {
    console.log('Update Success:', data);
  }
}

test();
