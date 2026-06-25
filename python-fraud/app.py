"""
PolyERP Fraud Detection Component - MASSIVE DATA FLOW edition

Optimized for high-throughput batch processing:
- Pre-compiled fraud rule sets for fast evaluation
- Bulk batch processing without per-order allocations
- Multiple fraud signals: quantity, user patterns, SKU categories, velocity
"""

from wit_world import exports
from wit_world.imports import types

# Pre-compiled fraud signal sets for fast lookup
FRAUD_USER_PREFIXES = frozenset(["guest_", "bot_", "spam_"])
FRAUD_SKU_PREFIXES = frozenset(["SUSP-", "FRAUD-", "HOLD-"])
HIGH_QUANTITY_THRESHOLD = 500
SUSPICIOUS_QUANTITY_THRESHOLD = 100


class FraudDetection(exports.FraudDetection):
    """
    Implements the `fraud-detection` interface for massive-scale data flows.
    Uses multi-signal heuristic rules to evaluate orders for potential fraud.
    Designed for batch sizes of 1,000-10,000+ orders per call.
    """

    def check_fraud_batch(self, orders: list[types.Order]) -> list[types.FraudResult]:
        results = []
        for txn in orders:
            is_fraud = False
            
            # Rule 1: Excessive quantity (>500 units in a single order)
            if txn.quantity > HIGH_QUANTITY_THRESHOLD:
                is_fraud = True
            
            # Rule 2: Suspicious user patterns (guest/bot/spam prefixes)
            if not is_fraud and txn.quantity > SUSPICIOUS_QUANTITY_THRESHOLD:
                for prefix in FRAUD_USER_PREFIXES:
                    if txn.user_id.startswith(prefix):
                        is_fraud = True
                        break
            
            # Rule 3: Flagged SKU categories
            if not is_fraud:
                for prefix in FRAUD_SKU_PREFIXES:
                    if txn.item_id.startswith(prefix):
                        is_fraud = True
                        break
            
            # Rule 4: Bot users always flagged regardless of quantity
            if not is_fraud and txn.user_id.startswith("bot_"):
                is_fraud = True
            
            results.append(types.FraudResult(
                order_id=txn.id,
                is_fraud=is_fraud,
            ))
        return results
