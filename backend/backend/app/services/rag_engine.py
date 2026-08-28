"""
rag_engine.py — Fast Local Vector Search & Retrieval Engine for Policy and Business Rules.

Uses TF-IDF vectorizer and Cosine Similarity to retrieve Top-K relevant knowledge chunks
for user policy questions and anomaly explanations.
"""
import logging
from typing import List, Dict, Any
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

log = logging.getLogger(__name__)

# Verified enterprise policy and business rules knowledge base
POLICY_DOCUMENTS = [
    {
        "id": "DOC-DISCOUNT-01",
        "title": "Enterprise Discount & Pricing Policy",
        "category": "discount_policy",
        "content": (
            "Standard discount policy permits maximum 20% discount on standard enterprise plans. "
            "Any discount exceeding 20% requires formal executive/VP approval. "
            "Applying discounts above 20% without an approved approval event triggers violation rule GF02 / R03 (over_discount). "
            "To remediate over-discounting, normalize the discount back to the plan baseline or process retro-approval."
        )
    },
    {
        "id": "DOC-INVOICING-01",
        "title": "Invoicing & Contract Matching Policy",
        "category": "invoicing_policy",
        "content": (
            "Invoices must strictly match the agreed contractual rate card. "
            "Under-billing or contract price mismatches trigger contractless discount / mismatch alerts (GF08 / R10). "
            "Invoices past payment due date (>30 days) are flagged as overdue uncollected revenue (R01 / GF07). "
            "Remediation requires issuing supplemental billing or initiating collections outreach."
        )
    },
    {
        "id": "DOC-PAYMENT-01",
        "title": "Payment & Refund Conformance Guidelines",
        "category": "payment_policy",
        "content": (
            "Duplicate payment processing occurs when two or more payments reference the same invoice ID (R02 / GF01). "
            "Duplicate payments must be flagged for immediate customer refund or credit balance adjustment. "
            "Refunds issued without a valid original payment reference trigger spurious refund alerts (GF05 / R08). "
            "All refund claims require verification against invoice settlement logs."
        )
    },
    {
        "id": "DOC-RENEWAL-01",
        "title": "Contract Renewal & Silent Churn Policy",
        "category": "renewal_policy",
        "content": (
            "Subscription renewal windows trigger 30 days prior to contract expiration. "
            "Failure to issue renewal notices or process auto-renewal triggers missed renewal alerts (R05 / GF04). "
            "Accounts showing >40% decrease in API/platform activity over 30 days are flagged for silent churn risk (R06 / GH02). "
            "Account managers must execute proactive retention playbooks for high-churn-risk accounts."
        )
    },
    {
        "id": "DOC-RECOVERY-01",
        "title": "Revenue Leakage Recovery Procedure",
        "category": "recovery_procedure",
        "content": (
            "Recoverable revenue is calculated deterministically as the delta between expected contractual revenue and actual collected revenue. "
            "Recovery priority is determined by total net recoverable amount (in INR) and customer churn risk score. "
            "All recovery actions executed via the Revenue Process Twin are recorded in the audit trail with timestamp, actor, and outcome."
        )
    },
    {
        "id": "DOC-SYSTEM-01",
        "title": "Revenue Process Twin System Capabilities",
        "category": "system_info",
        "content": (
            "The Revenue Process Twin monitors end-to-end order-to-cash workflows, detecting 11 leakage rules (R01-R11), "
            "8 process conformance rules (GF01-GF08), and 5 graph heuristic anomaly patterns (GH01-GH05). "
            "It correlates customers, invoices, payments, and contract renewals to provide real-time leakage detection and automated recovery recommendations."
        )
    }
]


class LocalRAGEngine:
    def __init__(self, documents: List[Dict[str, Any]] = None):
        self.documents = documents or POLICY_DOCUMENTS
        self.texts = [doc["content"] for doc in self.documents]
        self.vectorizer = TfidfVectorizer(stop_words="english")
        self.tfidf_matrix = self.vectorizer.fit_transform(self.texts)
        log.info("LocalRAGEngine initialized with %d knowledge documents.", len(self.documents))

    def retrieve(self, query: str, top_k: int = 2, min_score: float = 0.05) -> List[Dict[str, Any]]:
        if not query.strip():
            return []
        query_vec = self.vectorizer.transform([query])
        similarities = cosine_similarity(query_vec, self.tfidf_matrix)[0]

        scored_docs = []
        for idx, score in enumerate(similarities):
            if score >= min_score:
                scored_docs.append({
                    "score": float(score),
                    "document": self.documents[idx]
                })

        scored_docs.sort(key=lambda x: x["score"], reverse=True)
        return scored_docs[:top_k]


# Global singleton instance for high performance
rag_engine = LocalRAGEngine()


def query_knowledge_base(query: str, top_k: int = 2) -> List[Dict[str, Any]]:
    """Retrieve top relevant knowledge chunks for a policy/rule question."""
    return rag_engine.retrieve(query, top_k=top_k)
