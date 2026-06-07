require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function test() {
  console.log("Starting test...");
  
  // Find event with most logs
  const { data: logsCount, error: countError } = await supabase
    .from("unified_scan_logs")
    .select("event_id")
    .limit(100);
    
  if (countError || !logsCount || logsCount.length === 0) {
      console.log("No logs found or error:", countError);
      return;
  }
  
  const evId = logsCount[0].event_id;
  console.log("Testing with event:", evId);

  const limit = 10000;
  let allData = [];
  let currentOffset = 0;
  const fetchSize = 1000;
  
  console.time("FetchTime");
  
  while (allData.length < limit) {
    console.log("Fetching offset", currentOffset);
    const remaining = limit - allData.length;
    const currentLimit = Math.min(fetchSize, remaining);

    let q = supabase
      .from("unified_scan_logs")
      .select(`*, accreditations:athlete_id(id)`)
      .order("created_at", { ascending: false })
      .range(currentOffset, currentOffset + currentLimit - 1);

    if (evId) {
      q = q.eq("event_id", evId);
    }

    const { data, error } = await q;
    if (error) {
        console.error("Error:", error);
        break;
    }
    
    console.log("Fetched", data ? data.length : 0);
    if (!data || data.length === 0) break;
    
    allData = [...allData, ...data];
    currentOffset += data.length;
    
    if (data.length < currentLimit) break;
  }
  
  console.timeEnd("FetchTime");
  console.log("Total:", allData.length);
}

test();
