# Hy-Tek parity fixtures (git-ignored)

Drop ≥10 **real** Hy-Tek result PDFs here, then run the parity gate:

```bash
export ANON_KEY="<staging anon JWT>"          # parse-results is JWT-gated
# edge-only (dump parsed rows per file):
node scripts/parse-results-parity.mjs
# full parity vs the Python bridge:
#   in another shell:  BRIDGE_HOST=127.0.0.1 python scripts/medal_api.py
PY_URL="http://127.0.0.1:5001/api/bridge/results" node scripts/parse-results-parity.mjs
```

PDFs are **git-ignored** (athlete result data is PII — keep it out of history).
