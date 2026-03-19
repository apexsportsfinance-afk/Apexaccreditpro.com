const rawRowText = "10 Salaheen, Wrd 11 Hamilton Aquatics Dubai 3:16.24";
const cells = ["10", "Salaheen, Wrd", "11", "Hamilton Aquatics Dubai", "3:16.24"];
const fullRowText = cells.join(" ").toLowerCase();

const results = [];

let currentEventCode = "101";
let currentEventName = "Test Event";
let currentHeat = 4;

if (cells.length >= 4 && !fullRowText.includes('event') && !fullRowText.includes('lane')) {
    let laneVal = null;
    let rankVal = null;
    let nextHeat = null;
    
    let firstCell = cells[0].replace(/\D/g, '');
    if (firstCell && /^\d+$/.test(firstCell)) {
        let num = parseInt(firstCell, 10);
        if (num > 0 && num <= 10) laneVal = num;
        else rankVal = num;
    }

    let rawName = cells[1] || "";
    if (cells[0].toLowerCase().includes("heat")) {
        const heatNumMatch = rawName.match(/(\d+)\s+of\s+\d+/i);
        if (heatNumMatch) {
           nextHeat = parseInt(heatNumMatch[1], 10);
           rawName = rawName.replace(/\d+\s+of\s+\d+.*?$/i, '').trim();
        } else {
           const cell0Match = cells[0].match(/heat\s+(\d+)/i);
           if (cell0Match) nextHeat = parseInt(cell0Match[1], 10);
        }
    }

    const rawAge = cells[2];
    const rawTeam = cells[3];
    const rawSeed = cells[4];
    const rawFinal = (cells.length > 5) ? cells[5] : null;

    if (rawName && rawName.length > 2 && !rawName.toLowerCase().includes("name")) {
        let formattedName = rawName;
        if (formattedName.includes(',')) {
            const parts = formattedName.split(',');
            if (parts.length === 2) {
                formattedName = `${parts[1].trim()} ${parts[0].trim()}`;
            }
        }

        let ageVal = rawAge ? rawAge.replace(/\D/g, '') : null;

        if (nextHeat !== null) currentHeat = nextHeat;

        const athlete = {
            eventCode: currentEventCode,
            eventName: currentEventName,
            heat: currentHeat || 1,
            lane: laneVal,
            athleteName: formattedName,
            age: ageVal ? parseInt(ageVal, 10) : null,
            club: rawTeam,
            seedTime: rawSeed && rawSeed.length > 3 ? rawSeed : null,
            resultTime: rawFinal && rawFinal.length > 3 ? rawFinal : null,
            rank: rankVal
        };
        results.push(athlete);
        
        console.log("SUCCESSFULLY EXTRACTED ATHLETE:");
        console.log(athlete);
    } else {
        console.log("Failed rawName check");
    }
} else {
    console.log("Failed initial extraction check", {
        length: cells.length,
        hasEvent: fullRowText.includes('event'),
        hasLane: fullRowText.includes('lane')
    });
}
