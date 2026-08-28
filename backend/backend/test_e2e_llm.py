import urllib.request
import json
import time

url = 'http://localhost:8000/api/chat'
queries = [
    'Hello',
    'Why is Acme Corp losing revenue?',
    'Which customers have duplicate payments?',
    'Show me the biggest recovery opportunity',
    'Summarize the current leakage situation across all accounts.'
]

for i, q in enumerate(queries, 1):
    start = time.time()
    payload = json.dumps({'query': q}).encode('utf-8')
    req = urllib.request.Request(url, data=payload, headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req) as resp:
        res = json.loads(resp.read().decode('utf-8'))
        dur = time.time() - start
        print(f"=== TEST {i}: '{q}' ({dur:.2f}s, mode: {res.get('mode')}) ===")
        print("Answer:", res.get("answer"))
        print("Evidence Leak:", res.get("leak_amount_rs"), "| Recoverable:", res.get("recovery_estimate_rs"))
        print("Action:", res.get("recommended_action"))
        print()
