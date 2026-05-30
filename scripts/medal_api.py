import os
import re
from flask import Flask, request, jsonify
from flask_cors import CORS
from pypdf import PdfReader
from io import BytesIO

app = Flask(__name__)
# Allow CORS simply for the UI to talk to this local API
CORS(app)

EVENT_HEADER_PATTERN = re.compile(r'(?:\(Event\s+|Event\s+)(\d+)\s+(Boys|Girls|Mixed)\s+(.*?)\s+(\d+\s+.*Meter.*)', re.IGNORECASE)
INDIVIDUAL_RESULT_PATTERN = re.compile(r'^\s*([123])\s+(.+?)\s+(\d{1,2})\s+(.+?)\s+([\d:.]{4,})', re.IGNORECASE)

def parse_hytek_text(text):
    results = []
    current_event = None

    for line in text.splitlines():
        line = line.strip()
        if not line:
            continue
        
        # Check for event header
        event_match = EVENT_HEADER_PATTERN.search(line)
        if event_match:
            current_event = {
                "gender": event_match.group(2).strip(),
                "age_group": event_match.group(3).strip(),
                "event_name": event_match.group(4).replace(")", "").strip(),
                "event_type": "relay" if "Relay" in line else "individual"
            }
            continue
            
        if current_event:
            # Check for placement
            res_match = INDIVIDUAL_RESULT_PATTERN.match(line)
            if res_match:
                place = int(res_match.group(1))
                if place > 3:
                    continue

                results.append({
                    "swimmer_name": res_match.group(2).strip(),
                    "team": res_match.group(4).strip(),
                    "result_time": res_match.group(5).strip(),
                    "gender": current_event['gender'],
                    "age_group": current_event['age_group'],
                    "event_name": current_event['event_name'],
                    "event_type": current_event['event_type'],
                    "place": place
                })
    return results

@app.route('/api/bridge/results', methods=['POST'])
def upload_results():
    if 'files' not in request.files:
        return jsonify({'success': False, 'error': 'No standard files given'})
    
    files = request.files.getlist('files')
    competition_name = request.form.get('competition_name', 'Unknown Competition')

    all_results = []

    for file in files:
        if file.filename.endswith('.pdf'):
            try:
                reader = PdfReader(BytesIO(file.read()))
                text = ""
                for page in reader.pages:
                    try:
                        # Try to use layout mode to preserve tabular spacing
                        extracted = page.extract_text(extraction_mode="layout")
                    except TypeError:
                        # Fallback for older pypdf
                        extracted = page.extract_text()
                    
                    if extracted:
                        text += extracted + "\n"
                
                # IMPORTANT DEBUGGING: Write to a file so we can see what's failing if it still fails
                with open('last_extracted_pdf.txt', 'w', encoding='utf-8') as dbg:
                    dbg.write(text)

                parsed_medals = parse_hytek_text(text)
                # Assign the competition name to each parsed medal so it's recorded correctly
                for m in parsed_medals:
                    m['competition'] = competition_name

                all_results.extend(parsed_medals)

            except Exception as e:
                print("Error extracting PDF:", e)
                pass

    return jsonify({
        'success': True,
        'results': all_results
    })

if __name__ == '__main__':
    print("Starting HY-TEK Parsing Engine Bridge...")
    app.run(host='0.0.0.0', port=5001)
