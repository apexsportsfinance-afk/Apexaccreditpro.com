import re

def main():
    file_path = r"d:\CSA &Apex\New Project\Accreditation\Main System\Apexaccreditpro.com-main 12\Apexaccreditpro.com-main\src\pages\public\Scanner.jsx"
    
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Imports
    if "MainScannerAPI" not in content:
        content = content.replace(
            "import { EventsAPI, ZonesAPI, CategoriesAPI } from \"../../lib/storage\";",
            "import { EventsAPI, ZonesAPI, CategoriesAPI, MainScannerAPI } from \"../../lib/storage\";"
        )
        # If it wasn't there, maybe it's just ZonesAPI
        content = content.replace(
            "import { ZonesAPI } from \"../../lib/storage\";",
            "import { ZonesAPI, MainScannerAPI } from \"../../lib/storage\";"
        )

    # 2. fetchZoneConfig
    target_fetch = """            if (config.zone && config.mode === "attendance") {
              const currentZone = zones.find(z => String(z.code).toUpperCase() === String(config.zone).toUpperCase());
              if (currentZone) {
                setActiveZoneConfig(currentZone);
              }
            }"""
            
    replacement_fetch = """            if (config.zone && config.mode === "attendance") {
              const currentZone = zones.find(z => String(z.code).toUpperCase() === String(config.zone).toUpperCase());
              if (currentZone) {
                setActiveZoneConfig(currentZone);
              }
            } else if (!config.zone && config.mode === "attendance") {
              const mainConfig = await MainScannerAPI.getConfig(config.eventId);
              if (mainConfig) {
                setActiveZoneConfig({
                  code: "MAIN",
                  name: "Main Gate",
                  settings: mainConfig.settings,
                  ignoreDuplicates: mainConfig.ignoreDuplicates
                });
              }
            }"""
            
    if "await MainScannerAPI.getConfig" not in content:
        content = content.replace(target_fetch, replacement_fetch)

    # 3. recordScan Standard
    target_record = """        // --- STANDARD ACCESS LOGIC (General Zones) ---
        const recordRes = await AttendanceAPI.recordScan({
          eventId: config.eventId,
          athleteId: athlete.id,
          clubName: athlete.club,
          scannerLocation: activeZoneConfig?.name || (config.zone ? `Zone-${config.zone}` : (config.deviceLabel || "Gate Scanner")),
          sessionId: activeSession?.id || null,
          zoneOnly: isZoneLocked,
          scanMode: activeZoneConfig?.settings?.scanMode || "daily"
        });"""
        
    replacement_record = """        // --- STANDARD ACCESS LOGIC (General Zones) ---
        const recordRes = await AttendanceAPI.recordScan({
          eventId: config.eventId,
          athleteId: athlete.id,
          clubName: athlete.club,
          scannerLocation: activeZoneConfig?.name || (config.zone ? `Zone-${config.zone}` : (config.deviceLabel || "Gate Scanner")),
          sessionId: activeSession?.id || null,
          zoneOnly: isZoneLocked,
          scanMode: activeZoneConfig?.settings?.scanMode || "daily",
          ignoreDuplicates: activeZoneConfig?.ignoreDuplicates === true
        });"""

    if "ignoreDuplicates:" not in content:
        content = content.replace(target_record, replacement_record)

    # 4. logScanEvent Standard
    target_log = """        // AUDIT LOG
        AttendanceAPI.logScanEvent({
          eventId: config.eventId,
          athleteId: athlete.id,
          scanMode: isZoneLocked ? "zone_access" : "attendance",
          deviceLabel: config.deviceLabel,
          sessionId: activeSession?.id || null
        });

        // SUPER-FAST AUTO-RESUME: 8.0s for High-Traffic Gates (Adjusted per user request)"""
        
    replacement_log = """        // AUDIT LOG
        if (!recordRes.ignoredDuplicate) {
          AttendanceAPI.logScanEvent({
            eventId: config.eventId,
            athleteId: athlete.id,
            scanMode: isZoneLocked ? "zone_access" : "attendance",
            deviceLabel: config.deviceLabel,
            sessionId: activeSession?.id || null
          });
        }

        // SUPER-FAST AUTO-RESUME: 8.0s for High-Traffic Gates (Adjusted per user request)"""
        
    if "if (!recordRes.ignoredDuplicate)" not in content:
        content = content.replace(target_log, replacement_log)

    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
        
    print("Scanner.jsx patched successfully.")

if __name__ == "__main__":
    main()
