import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://dixelomafeobabahqeqg.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRpeGVsb21hZmVvYmFiYWhxZXFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzMzA4MzYsImV4cCI6MjA4NjkwNjgzNn0.YD1lj0T6kFoM2XyeYonIC3bmLiPkKBvmXEHEr5VMaGM";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function check() {
  const { data: ids, error } = await supabase.from('accreditations').select('id');
  if (error) { console.error(error); return; }
  
  let b64Count = 0;
  for (const {id} of ids) {
    const { data: row } = await supabase.from('accreditations').select('photo_url, id_document_url').eq('id', id).single();
    if (row) {
      if (row.photo_url && row.photo_url.startsWith('data:')) {
          console.log(`ID ${id} has base64 photo_url`);
          b64Count++;
      }
      if (row.id_document_url && row.id_document_url.startsWith('data:')) {
          console.log(`ID ${id} has base64 id_document_url`);
          b64Count++;
      }
    }
  }
  console.log('Total rows:', ids.length);
  console.log('Base64 fields remaining:', b64Count);
}
check();
