const fetch = require('node-fetch');

const SUPABASE_URL = "https://dixelomafeobabahqeqg.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRpeGVsb21hZmVvYmFiYWhxZXFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzMzA4MzYsImV4cCI6MjA4NjkwNjgzNn0.YD1lj0T6kFoM2XyeYonIC3bmLiPkKBvmXEHEr5VMaGM";

async function testEmail() {
  console.log("Testing Edge Function...");
  try {
    const payload = {
      to: "info@apexsports.ae",
      name: "Sharbel Aleid",
      customSubject: "Test Accreditation Update",
      customBody: "This is a test approval email sent directly to isolate the live issue.",
      type: "custom"
    };

    const response = await fetch(`${SUPABASE_URL}/functions/v1/send-accreditation-email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    console.log("Status:", response.status);
    console.log("Response:", data);
  } catch (err) {
    console.error("Error:", err);
  }
}

testEmail();
