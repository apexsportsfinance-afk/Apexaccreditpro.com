const SUPABASE_URL = "https://dixelomafeobabahqeqg.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRpeGVsb21hZmVvYmFiYWhxZXFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzMzA4MzYsImV4cCI6MjA4NjkwNjgzNn0.YD1lj0T6kFoM2XyeYonIC3bmLiPkKBvmXEHEr5VMaGM";

fetch(`${SUPABASE_URL}/functions/v1/send-accreditation-email`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
  },
  body: JSON.stringify({
    to: "info@apexsports.ae",
    name: "Test User",
    customSubject: "Test",
    customBody: "Test",
    type: "custom"
  })
}).then(r => r.json()).then(console.log).catch(console.error);
