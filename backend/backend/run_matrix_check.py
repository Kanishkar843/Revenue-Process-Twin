import urllib.request
import json

url = 'http://localhost:8000/api/chat'
tests = [
    'hey',
    'hello',
    'what is your name?',
    'what can you do?',
    'what is revenue leakage?',
    'how many leakage cases are there?',
    'which customer has the highest leakage?',
    'what is the most common leakage type?',
    'why was invoice INV-2026-00025 flagged?',
    'how much can we recover?',
    'what is the discount policy?',
    'what should we do about the highest-risk case?',
    'tell me something completely unrelated to revenue leakage'
]

for i, q in enumerate(tests, 1):
    req = urllib.request.Request(url, data=json.dumps({'query': q}).encode(), headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req) as resp:
        res = json.loads(resp.read().decode())
        print(f"Test {i:02d}: '{q}'")
        print(f"  INTENT: {res.get('intent')} | MODE: {res.get('mode')}")
        print(f"  ANSWER: {res.get('answer')}")
        print("-" * 60)
