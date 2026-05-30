import re

with open('src/pages/public/Scanner.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

orig = '''              setLastScanResult({
                type: "athlete_entry",
                status: "success",
                athlete,
                message: recordRes.status === "error" ? "Offline Record" : "Attendance Marked",
                sessionName: activeSession?.session_name || null
              });
              
              audioService.playSuccessEntry();
              playZoneMessage("firstScan", athlete, "Attendance Marked", "Welcome [FullName]", activeZoneConfig);'''

new_val = '''              const isDuplicate = recordRes.isNew === false;
              let finalMessage = recordRes.status === "error" ? "Offline Record" : "Attendance Marked";
              
              if (isDuplicate) {
                audioService.beep(440, 200, 'sine', 0.2);
                finalMessage = playZoneMessage("secondScan", athlete, "Already Attended", "Already Attended", activeZoneConfig);
              } else {
                audioService.playSuccessEntry();
                finalMessage = playZoneMessage("firstScan", athlete, finalMessage, "Welcome [FullName]", activeZoneConfig);
              }

              setLastScanResult({
                type: "athlete_entry",
                status: "success",
                athlete,
                message: finalMessage,
                sessionName: activeSession?.session_name || null
              });'''

content = content.replace(orig, new_val)

with open('src/pages/public/Scanner.jsx', 'w', encoding='utf-8') as f:
    f.write(content)
print("Done")
