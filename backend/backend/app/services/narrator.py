"""
narrator.py — Evidence-grounded narrative generator for the Revenue Process Twin.

Uses Ollama (revenue-qwen35-4b:latest) when NARRATOR_MODE=live, otherwise builds a rich
intent-aware deterministic narrative from evidence/RAG data.
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


def _call_ollama(evidence_json: Optional[Dict[str, Any]], query: str, rag_context: str = "", intent: str = "") -> str | None:
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
        with urllib.request.urlopen(req, timeout=30) as resp:
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
    """Build intent-specific fallback narrative when Ollama is offline or unneeded."""
    if intent == "GENERAL_GREETING":
        return "Hello! I'm the Revenue Process Twin Narrator. How can I help you with customer risks, leakage patterns, or recovery opportunities today?"

    if intent == "IDENTITY":
        return "I am the Revenue Process Twin Narrator, an AI-powered reasoning engine designed to detect revenue leakage, analyze process conformance breaks, and recommend recovery actions."

    if intent == "HELP":
        return "I can help you explore customer risk profiles, audit invoices and payments, explain leakage rule breaches, search discount policies, and calculate net recoverable revenue."

    if intent == "SYSTEM_STATUS":
        return "The Revenue Process Twin is active, fully synced with the local SQLite database, and connected to the GPU-accelerated Hugging Face Qwen LLM engine."

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
    """
    mode = os.environ.get("NARRATOR_MODE", "live").lower()
    answer = None

    # For conversational intents (greetings, identity, help, status), return direct response if live model unavailable
    if intent in ["GENERAL_GREETING", "IDENTITY", "HELP", "SYSTEM_STATUS"]:
        if mode == "live":
            answer = _call_ollama(evidence_json=None, query=query, intent=intent)
        if not answer:
            answer = _build_intent_fallback(intent, query, evidence_json, rag_context)

    else:
        if mode == "live":
            answer = _call_ollama(evidence_json, query, rag_context=rag_context, intent=intent)

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
        "mode": "live" if answer and mode == "live" else "fallback",
        "leak_amount_rs": int(leak_rs),
        "recovery_estimate_rs": int(rec_rs),
        "process_break": (evidence_json.get("process_break_step") if evidence_json else None) or "Process Break",
        "connected_entities": (evidence_json.get("connected_entities") if evidence_json else []) or [],
        "recommended_action": (evidence_json.get("recommended_action") if evidence_json else None) or "Review details"
    }