import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const supabaseUrl = "https://dixelomafeobabahqeqg.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRpeGVsb21hZmVvYmFiYWhxZXFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzMzA4MzYsImV4cCI6MjA4NjkwNjgzNn0.YD1lj0T6kFoM2XyeYonIC3bmLiPkKBvmXEHEr5VMaGM";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const uploadDir = path.join(__dirname, 'server', 'uploads', 'acc');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

function processBase64(base64String, prefix, id) {
  if (!base64String || !base64String.startsWith('data:')) return null;

  try {
    const matches = base64String.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      return null;
    }
    const type = matches[1];
    const data = Buffer.from(matches[2], 'base64');
    
    let ext = '.png';
    if (type.includes('jpeg') || type.includes('jpg')) ext = '.jpg';
    if (type.includes('pdf')) ext = '.pdf';
    
    const filename = `${prefix}-${id}${ext}`;
    const filePath = path.join(uploadDir, filename);
    
    fs.writeFileSync(filePath, data);
    return `/api/images/${filename}`;
  } catch (err) {
    console.error(`Error processing ${prefix} for ID ${id}:`, err);
    return null;
  }
}

async function runMigration() {
  console.log("Starting Migration... Fetching IDs only to prevent timeout.");
  const { data: idRows, error: idError } = await supabase.from('accreditations').select('id');
  if (idError) {
    console.error("Failed to fetch IDs:", idError);
    return;
  }
  
  console.log(`Found ${idRows.length} total accreditations. Processing one by one...`);
  
  let totalProcessed = 0;
  
  for (const { id } of idRows) {
    // Process photo first
    const { data: photoData, error: photoErr } = await supabase.from('accreditations').select('photo_url').eq('id', id).single();
    let updates = {};
    let isUpdated = false;

    if (!photoErr && photoData && photoData.photo_url) {
      const newPhotoUrl = processBase64(photoData.photo_url, 'photo', id);
      if (newPhotoUrl) {
        updates.photo_url = newPhotoUrl;
        isUpdated = true;
      }
    }

    // Then process ID Document
    const { data: docData, error: docErr } = await supabase.from('accreditations').select('id_document_url').eq('id', id).single();
    if (!docErr && docData && docData.id_document_url) {
      const newIdDocUrl = processBase64(docData.id_document_url, 'id', id);
      if (newIdDocUrl) {
        updates.id_document_url = newIdDocUrl;
        isUpdated = true;
      }
    }
    
    if (isUpdated) {
      process.stdout.write(`Updating ID ${id}: `);
      const { error: updateError } = await supabase.from('accreditations').update(updates).eq('id', id);
      if (updateError) {
        console.log(`Failed! ${updateError.message}`);
      } else {
        console.log("Saved.");
        totalProcessed++;
      }
    }
  }
  
  console.log(`Migration Complete. Successfully updated ${totalProcessed} rows.`);
}

runMigration().catch(console.error);
