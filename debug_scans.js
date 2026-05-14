
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://dixelomafeobabahqeqg.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRpeGVsb21hZmVvYmFiYWhxZXFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzMzA4MzYsImV4cCI6MjA4NjkwNjgzNn0.YD1lj0T6kFoM2XyeYonIC3bmLiPkKBvmXEHEr5VMaGM';

async function debug() {
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  const { data: athlete, error: aErr } = await supabase
    .from('accreditations')
    .select('id, event_id, first_name, last_name')
    .eq('accreditation_id', 'ACC-2026-3EE69442')
    .maybeSingle();
    
  if (aErr) console.error('Error finding athlete:', aErr);
  console.log('Athlete Found:', athlete);
  
  if (athlete) {
    const { data: scans, error: sErr } = await supabase
      .from('event_attendance')
      .select('*')
      .eq('athlete_id', athlete.id);
      
    if (sErr) console.error('Error finding scans:', sErr);
    console.log('Scans Found:', (scans || []).length);
    if (scans && scans.length > 0) {
      console.log('Recent Scan Locations:', scans.map(s => s.scanner_location));
    }
    
    const { data: zones, error: zErr } = await supabase
      .from('zones')
      .select('*')
      .eq('event_id', athlete.event_id);
      
    if (zErr) console.error('Error finding zones:', zErr);
    console.log('All Zones Found:', (zones || [])
      .map(z => ({ name: z.name, code: z.code, isHidden: z.settings?.isHidden, scanMode: z.settings?.scanMode }))
    );
  }
}

debug();
