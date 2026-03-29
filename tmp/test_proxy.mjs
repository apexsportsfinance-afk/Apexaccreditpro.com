import { supabase } from './src/lib/supabase.js';

async function test() {
  console.log("Testing PROXIED Supabase client...");
  
  try {
    // Test auth (to see if it hits the Proxy's 'get' and returns target[prop])
    const { data: { session } } = await supabase.auth.getSession();
    console.log("Auth Session:", session ? "Found" : "Not Found");

    // Test 'from' (the core of the Proxy)
    console.log("Fetching events via Proxy...");
    const { data, error, count } = await supabase
      .from('events')
      .select('*', { count: 'exact', head: true });
    
    if (error) {
      console.error("Proxied Supabase Error (Events):", error);
    } else {
      console.log("Proxied Events Success!");
      console.log("Total Events Count:", count);
    }

    console.log("Fetching accreditations via Proxy...");
    const { data: accData, error: accError, count: accCount } = await supabase
      .from('accreditations')
      .select('*', { count: 'exact', head: true });

    if (accError) {
      console.error("Proxied Accreditations Error:", accError);
    } else {
      console.log("Proxied Accreditations Success!");
      console.log("Total Accreditations Count:", accCount);
    }

  } catch (err) {
    console.error("Critical Proxied Failure:", err);
  }
}

test();
