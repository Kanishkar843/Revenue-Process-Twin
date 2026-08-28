"""
query_router.py — Intent classification and entity extraction for Revenue Process Twin.

Categorizes user input into exact intents to prevent sending global leakage context for simple greetings, identity questions, or specific targeted lookups.
"""
import re
from dataclasses import dataclass
from typing import Dict, Any, List, Optional


class Intent:
    GENERAL_GREETING = "GENERAL_GREETING"
    IDENTITY = "IDENTITY"
    HELP = "HELP"
    SYSTEM_STATUS = "SYSTEM_STATUS"
    CUSTOMER_LOOKUP = "CUSTOMER_LOOKUP"
    INVOICE_LOOKUP = "INVOICE_LOOKUP"
    PAYMENT_LOOKUP = "PAYMENT_LOOKUP"
    LEAKAGE_OVERVIEW = "LEAKAGE_OVERVIEW"
    LEAKAGE_BY_TYPE = "LEAKAGE_BY_TYPE"
    ANOMALY_EXPLANATION = "ANOMALY_EXPLANATION"
    RECOVERY_RECOMMENDATION = "RECOVERY_RECOMMENDATION"
    POLICY_QUESTION = "POLICY_QUESTION"
    UNKNOWN = "UNKNOWN"


@dataclass
class ExtractedEntities:
    customer_id: Optional[str] = None
    invoice_id: Optional[str] = None
    transaction_id: Optional[str] = None
    rule_id: Optional[str] = None
    leak_type: Optional[str] = None


@dataclass
class QueryClassification:
    intent: str
    confidence: float
    entities: ExtractedEntities
    query: str


def classify_query(query: str, customer_names: List[str] = None) -> QueryClassification:
    q = query.strip()
    q_lower = q.lower()
    entities = ExtractedEntities()

    # 1. Extract IDs using Regex
    cust_match = re.search(r'\bCUST-\d+\b', q, re.IGNORECASE)
    if cust_match:
        entities.customer_id = cust_match.group(0).upper()

    inv_match = re.search(r'\bINV-[\w\-]+\b', q, re.IGNORECASE)
    if inv_match:
        entities.invoice_id = inv_match.group(0).upper()

    txn_match = re.search(r'\bTXN-\d+\b', q, re.IGNORECASE)
    if txn_match:
        entities.transaction_id = txn_match.group(0).upper()

    rule_match = re.search(r'\b(R\d{2}|GF\d{2}|GH\d{2})\b', q, re.IGNORECASE)
    if rule_match:
        entities.rule_id = rule_match.group(0).upper()

    # Match leak types
    if any(k in q_lower for k in ["duplicate", "paid twice", "dual payment", "double payment"]):
        entities.leak_type = "duplicate_payment"
    elif any(k in q_lower for k in ["overdue", "unpaid invoice", "uncollected", "late invoice", "outstanding invoice"]):
        entities.leak_type = "invoice_overdue"
    elif any(k in q_lower for k in ["discount", "over-discount", "over discount", "unapproved discount"]):
        entities.leak_type = "over_discount"
    elif any(k in q_lower for k in ["refund ratio", "high refund", "excess refund"]):
        entities.leak_type = "high_refund_ratio"
    elif any(k in q_lower for k in ["missed renewal", "failed renewal", "renewal missed"]):
        entities.leak_type = "missed_renewal"
    elif any(k in q_lower for k in ["churn", "churning", "usage decline"]):
        entities.leak_type = "silent_churn"
    elif any(k in q_lower for k in ["spurious refund", "fraudulent refund"]):
        entities.leak_type = "spurious_refund"
    elif any(k in q_lower for k in ["contractless"]):
        entities.leak_type = "contractless_enterprise_discount"

    # Fuzzy customer name match
    if customer_names and not entities.customer_id:
        for cname in customer_names:
            if cname.lower() in q_lower:
                # We retain customer_id or customer_name match
                break

    # 2. Match Intents

    # Greetings
    greeting_words = {"hey", "hello", "hi", "greetings", "good morning", "good afternoon", "good evening", "howdy", "hola"}
    words = set(re.findall(r'\w+', q_lower))
    if q_lower in greeting_words or (len(words) <= 3 and bool(words.intersection(greeting_words))):
        return QueryClassification(intent=Intent.GENERAL_GREETING, confidence=1.0, entities=entities, query=q)

    # Identity
    if any(p in q_lower for p in ["who are you", "what is your name", "what's your name", "tell me about yourself", "your identity"]):
        return QueryClassification(intent=Intent.IDENTITY, confidence=1.0, entities=entities, query=q)

    # Help / Capabilities
    if any(p in q_lower for p in ["what can you do", "help", "how do you work", "capabilities", "what do you do", "commands"]):
        return QueryClassification(intent=Intent.HELP, confidence=1.0, entities=entities, query=q)

    # System Status
    if any(p in q_lower for p in ["system status", "health", "engine status", "is system active"]):
        return QueryClassification(intent=Intent.SYSTEM_STATUS, confidence=1.0, entities=entities, query=q)

    # Specific Customer / Invoice / Payment Lookups
    if entities.customer_id or (customer_names and any(c.lower() in q_lower for c in customer_names)):
        return QueryClassification(intent=Intent.CUSTOMER_LOOKUP, confidence=0.9, entities=entities, query=q)

    if entities.invoice_id or "invoice" in q_lower:
        return QueryClassification(intent=Intent.INVOICE_LOOKUP, confidence=0.85, entities=entities, query=q)

    if entities.transaction_id or "payment" in q_lower or "transaction" in q_lower:
        return QueryClassification(intent=Intent.PAYMENT_LOOKUP, confidence=0.85, entities=entities, query=q)

    # Policy / Business Rule Question
    if any(k in q_lower for k in ["policy", "rule", "guideline", "threshold", "sla", "procedure", "what is the discount policy", "refund policy"]):
        return QueryClassification(intent=Intent.POLICY_QUESTION, confidence=0.9, entities=entities, query=q)

    # Recovery Recommendation
    if any(k in q_lower for k in ["how much can we recover", "recovery opportunity", "what should we do", "recommendation", "recoverable"]):
        return QueryClassification(intent=Intent.RECOVERY_RECOMMENDATION, confidence=0.9, entities=entities, query=q)

    # Anomaly Explanation / Case Explanation
    if any(k in q_lower for k in ["why was", "explain alert", "explain anomaly", "flagged", "process break", "breach"]):
        return QueryClassification(intent=Intent.ANOMALY_EXPLANATION, confidence=0.85, entities=entities, query=q)

    # Leakage Overview / Type
    if entities.leak_type:
        return QueryClassification(intent=Intent.LEAKAGE_BY_TYPE, confidence=0.9, entities=entities, query=q)

    if any(k in q_lower for k in ["how many leakage", "total leakage", "leakage overview", "leakage summary", "biggest leakage", "highest leakage"]):
        return QueryClassification(intent=Intent.LEAKAGE_OVERVIEW, confidence=0.9, entities=entities, query=q)

    # Default fallback intent
    return QueryClassification(intent=Intent.UNKNOWN, confidence=0.5, entities=entities, query=q)
