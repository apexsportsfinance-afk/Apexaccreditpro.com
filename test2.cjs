require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function test() {
  console.log("Starting test...");
  
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

  let allData = [];
  let currentOffset = 0;
  const fetchSize = 1000;
  
  while (true) {
    let q = supabase
      .from("unified_scan_logs")
      .select(`*`)
      .eq("event_id", evId)
      .range(currentOffset, currentOffset + fetchSize - 1);

    const { data, error } = await q;
    if (error) {
        console.error("Error:", error);
        break;
    }
    
    if (!data || data.length === 0) break;
    
    allData = [...allData, ...data];
    currentOffset += data.length;
    
    if (data.length < fetchSize) break;
  }
  
  console.log("Total logs for event:", allData.length);
  
  // Analyze refreshment area
  const refreshmentLogs = allData.filter(log => log.device_label && log.device_label.toLowerCase().includes("refreshment"));
  console.log("Refreshment logs total:", refreshmentLogs.length);
  
  const uniqueAthletes = new Set();
  const uniqueSpectators = new Set();
  const nullIds = [];
  
  refreshmentLogs.forEach(log => {
      if (log.athlete_id) uniqueAthletes.add(log.athlete_id);
      else if (log.spectator_id) uniqueSpectators.add(log.spectator_id);
      else nullIds.push(log);
  });
  
  console.log("Unique Athletes:", uniqueAthletes.size);
  console.log("Unique Spectators:", uniqueSpectators.size);
  console.log("Logs with no athlete/spectator ID:", nullIds.length);
  
}

test();
