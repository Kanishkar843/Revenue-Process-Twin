"""
narrator.py — Evidence-grounded narrative generator for the Revenue Process Twin.

Supports:
  1. Groq Cloud API (GROQ_API_KEY) — High performance cloud LLM (llama-3.3-70b-versatile)
  2. Ollama (revenue-qwen35-4b:latest) — Local GPU LLM fallback
  3. Intent-Aware Deterministic Fallback — Safe zero-downtime execution
"""
import os
import json
import logging
import urllib.request
import urllib.error
from typing import Dict, Any, Optional

log = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are the Revenue Process Twin Narrator AI.
Your job is to answer ONLY the user's CURRENT QUESTION concisely in plain English (max 120 words).

Strict Rules:
1. Answer ONLY what the user asked.
2. For greetings or identity questions, respond conversationally.
3. NEVER output global system leakage totals (such as 4551 alerts or total leakage) unless the user specifically asks for a system-wide leakage summary.
4. Use provided Evidence JSON as numerical truth for amounts, process breaks, and accounts.
5. Use provided Policy Context as business rule truth.
6. Reply in clean, plain sentences. Do not hallucinate data."""


def _fmt(paise: int) -> str:
    """Format paise as a readable rupee string."""
    rs = paise / 100.0
    if rs >= 100_000:
        return f"₹{rs/100_000:.2f}L"
    if rs >= 1_000:
        return f"₹{rs:,.0f}"
    return f"₹{rs:.2f}"


def _call_groq(evidence_json: Optional[Dict[str, Any]], query: str, rag_context: str = "", intent: str = "") -> Optional[str]:
    """Call Groq Cloud API if GROQ_API_KEY is available. Returns None on failure or missing key."""
    api_key = os.environ.get("GROQ_API_KEY", "").strip()
    if not api_key:
        return None

    model = os.environ.get("GROQ_MODEL", "llama-3.3-70b-versatile").strip()
    url = "https://api.groq.com/openai/v1/chat/completions"

    context_str = ""
    if rag_context:
        context_str += f"Policy/Knowledge Context:\n{rag_context}\n\n"
    if evidence_json:
        context_str += f"Database Evidence:\n{json.dumps(evidence_json, indent=2)}\n\n"

    user_content = (
        f"{context_str}"
        f"User Question: {query}\n\n"
        f"Provide a clear, direct, narrative answer:"
    )

    payload = json.dumps({
        "model": model,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_content}
        ],
        "temperature": 0.2,
        "max_tokens": 350
    }).encode("utf-8")

    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}"
    }

    try:
        req = urllib.request.Request(url, data=payload, headers=headers)
        with urllib.request.urlopen(req, timeout=10) as resp:
            res_data = json.loads(resp.read().decode("utf-8"))
            choices = res_data.get("choices", [])
            if choices and len(choices) > 0:
                answer = choices[0].get("message", {}).get("content", "").strip()
                if answer:
                    log.info("Groq Cloud LLM narrative generated (%d chars) for intent %s", len(answer), intent)
                    return answer
            log.warning("Groq API returned empty response choices")
    except urllib.error.URLError as e:
        log.warning("Groq API connection error: %s", e)
    except Exception as e:
        log.warning("Groq API error: %s", e)
    return None


def _call_ollama(evidence_json: Optional[Dict[str, Any]], query: str, rag_context: str = "", intent: str = "") -> Optional[str]:
    """Try to get an AI narrative from Ollama. Returns None on failure."""
    host = os.environ.get("OLLAMA_HOST", "http://localhost:11434")
    model = os.environ.get("OLLAMA_MODEL", "revenue-qwen35-4b:latest")
    url = f"{host}/api/generate"

    context_str = ""
    if rag_context:
        context_str += f"Policy/Knowledge Context:\n{rag_context}\n\n"
    if evidence_json:
        context_str += f"Database Evidence:\n{json.dumps(evidence_json, indent=2)}\n\n"

    prompt = (
        f"{SYSTEM_PROMPT}\n\n"
        f"{context_str}"
        f"User Question: {query}\n\n"
        f"Narrative Answer:"
    )

    payload = json.dumps({
        "model": model,
        "prompt": prompt,
        "stream": False,
        "options": {
            "num_predict": 200,
            "temperature": 0.2
        }
    }).encode("utf-8")

    try:
        req = urllib.request.Request(url, data=payload, headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=5) as resp:
            result = json.loads(resp.read().decode("utf-8"))
            answer = result.get("response", "").strip()
            if answer:
                log.info("Ollama narrative generated (%d chars) for intent %s", len(answer), intent)
                return answer
            log.warning("Ollama returned empty response")
    except urllib.error.URLError as e:
        log.warning("Ollama connection failed: %s", e)
    except Exception as e:
        log.warning("Ollama error: %s", e)
    return None


def _build_intent_fallback(intent: str, query: str, evidence: Optional[Dict[str, Any]], rag_context: str) -> str:
    """Build intent-specific fallback narrative when AI services are offline or unneeded."""
    if intent == "GENERAL_GREETING":
        return "Hello! I'm the Revenue Process Twin Narrator. How can I help you with customer risks, leakage patterns, or recovery opportunities today?"

    if intent == "IDENTITY":
        return "I am the Revenue Process Twin Narrator, an AI-powered reasoning engine designed to detect revenue leakage, analyze process conformance breaks, and recommend recovery actions."

    if intent == "HELP":
        return "I can help you explore customer risk profiles, audit invoices and payments, explain leakage rule breaches, search discount policies, and calculate net recoverable revenue."

    if intent == "SYSTEM_STATUS":
        return "The Revenue Process Twin is active, fully synced with the database, and connected to the intelligent LLM narrative engine."

    if intent == "POLICY_QUESTION" and rag_context:
        return f"Based on enterprise policy: {rag_context}"

    if not evidence:
        return "I couldn't find specific database records matching your query. Please specify a customer ID (e.g. CUST-1001) or invoice ID."

    cust_id = evidence.get("customer_id", "")
    cust_name = evidence.get("customer_name", "Enterprise Account")
    leak = int(evidence.get("leak_amount_paise", 0))
    rec = int(evidence.get("recoverable_paise", 0))
    brk = evidence.get("process_break_step", "process deviation")
    action = evidence.get("recommended_action", "review the alert")
    cnt = evidence.get("alert_count", 1)

    if cust_id == "SYSTEM_WIDE":
        total_cnt = evidence.get("total_active_alerts", 0)
        return (
            f"The Revenue Process Twin has detected {total_cnt} active leakage alert(s) across enterprise accounts. "
            f"Total identified leakage: {_fmt(leak)}, of which {_fmt(rec)} is immediately recoverable. "
            f"Top violation: {brk}. Recommended action: {action}."
        )

    return (
        f"For account {cust_name} ({cust_id}), {cnt} alert(s) detected. "
        f"Total identified leak amount: {_fmt(leak)}, with estimated recoverable amount: {_fmt(rec)}. "
        f"Process break identified at '{brk}'. "
        f"Recommended action: {action}."
    )


def narrator(
    evidence_json: Optional[Dict[str, Any]] = None,
    query: str = "",
    rag_context: str = "",
    intent: str = ""
) -> Dict[str, Any]:
    """
    Main narrative entrypoint.
    Determines response based on intent, evidence, and RAG knowledge.
    Order of precedence:
      1. Groq Cloud API (if GROQ_API_KEY is configured)
      2. Ollama Local LLM (if running)
      3. Intent-Aware Deterministic Fallback
    """
    answer = None
    provider = "fallback"

    # Step 1: Try Groq Cloud API
    answer = _call_groq(evidence_json, query, rag_context=rag_context, intent=intent)
    if answer:
        provider = "groq"

    # Step 2: Fallback to Ollama if Groq not available or failed
    if not answer:
        answer = _call_ollama(evidence_json, query, rag_context=rag_context, intent=intent)
        if answer:
            provider = "ollama"

    # Step 3: Fallback to Deterministic Structured Narrative
    if not answer:
        answer = _build_intent_fallback(intent, query, evidence_json, rag_context)

    leak_paise = evidence_json.get("leak_amount_paise", 0) if evidence_json else 0
    leak_rs = leak_paise / 100.0 if leak_paise else 0.0

    rec_paise = evidence_json.get("recoverable_paise", 0) if evidence_json else 0
    rec_rs = rec_paise / 100.0 if rec_paise else 0.0

    return {
        "answer": answer,
        "narrative": answer,
        "intent": intent,
        "evidence": evidence_json,
        "mode": provider,
        "leak_amount_rs": int(leak_rs),
        "recovery_estimate_rs": int(rec_rs),
        "process_break": (evidence_json.get("process_break_step") if evidence_json else None) or "Process Break",
        "connected_entities": (evidence_json.get("connected_entities") if evidence_json else []) or [],
        "recommended_action": (evidence_json.get("recommended_action") if evidence_json else None) or "Review details"
    }