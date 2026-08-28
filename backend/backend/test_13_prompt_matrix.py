import urllib.request
import json
import time

url = 'http://localhost:8000/api/chat'

test_cases = [
    ("TEST 1: Greeting 'hey'", "hey", ["hello", "hi", "narrator", "how can i help"], ["4551 active leakage", "₹227710L"]),
    ("TEST 2: Greeting 'hello'", "hello", ["hello", "hi", "narrator", "how can i help"], ["4551 active leakage", "₹227710L"]),
    ("TEST 3: Identity 'what is your name?'", "what is your name?", ["revenue process twin narrator", "narrator", "i am"], ["4551 active leakage", "₹227710L"]),
    ("TEST 4: Capabilities 'what can you do?'", "what can you do?", ["help", "risk", "leakage", "invoice", "payment"], []),
    ("TEST 5: Definition 'what is revenue leakage?'", "what is revenue leakage?", ["leakage", "revenue", "uncollected", "discount", "breach", "process"], []),
    ("TEST 6: Count 'how many leakage cases are there?'", "how many leakage cases are there?", ["alert", "case", "detected", "total", "active"], []),
    ("TEST 7: Customer 'which customer has the highest leakage?'", "which customer has the highest leakage?", ["acme", "cust-", "account", "customer", "leakage"], []),
    ("TEST 8: Leak Type 'what is the most common leakage type?'", "what is the most common leakage type?", ["discount", "invoice", "payment", "refund", "renewal", "leakage", "overdue"], []),
    ("TEST 9: Invoice 'why was invoice INV-2026-00025 flagged?'", "why was invoice INV-2026-00025 flagged?", ["invoice", "flagged", "audit", "rate", "overdue", "payment", "verification", "inv-"], []),
    ("TEST 10: Recovery 'how much can we recover?'", "how much can we recover?", ["recoverable", "recover", "₹", "total"], []),
    ("TEST 11: RAG Policy 'what is the discount policy?'", "what is the discount policy?", ["20%", "discount", "policy", "approval", "vp", "threshold"], []),
    ("TEST 12: Recommendation 'what should we do about the highest-risk case?'", "what should we do about the highest-risk case?", ["recommend", "action", "recover", "review", "normalize"], []),
    ("TEST 13: Scope 'tell me something completely unrelated to revenue leakage'", "tell me something completely unrelated to revenue leakage", ["revenue", "twin", "data", "scope", "help", "information"], [])
]

print("=================================================================")
print("  EXECUTING 13-PROMPT MASTER TEST MATRIX FOR QUESTION AWARENESS  ")
print("=================================================================\n")

passed_count = 0

for name, query, required_any, forbidden_all in test_cases:
    start = time.time()
    payload = json.dumps({'query': query}).encode('utf-8')
    req = urllib.request.Request(url, data=payload, headers={'Content-Type': 'application/json'})
    
    try:
        with urllib.request.urlopen(req, timeout=35) as resp:
            res = json.loads(resp.read().decode('utf-8'))
            dur = time.time() - start
            answer = res.get('answer', '')
            intent = res.get('intent', '')
            mode = res.get('mode', '')
            
            answer_lower = answer.lower()
            
            # Validation
            has_forbidden = any(f in answer_lower for f in forbidden_all)
            has_required = any(r in answer_lower for r in required_any) if required_any else True
            
            is_pass = not has_forbidden and has_required
            
            status = "PASS" if is_pass else "FAIL"
            if is_pass:
                passed_count += 1
                
            print(f"[{status}] {name} ({dur:.2f}s | intent: {intent} | mode: {mode})")
            print(f"    Query:  \"{query}\"")
            print(f"    Answer: \"{answer[:140]}...\"\n")
    except Exception as e:
        print(f"[FAIL] {name} Error: {e}\n")

print(f"SUMMARY: {passed_count} / {len(test_cases)} tests PASSED.")
