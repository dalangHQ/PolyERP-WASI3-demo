"""
PolyERP Fraud Detection Component - Sync batch API
"""

from wit_world import exports
from wit_world.imports import types


class FraudDetection(exports.FraudDetection):
    """
    Implements the `fraud-detection` interface.
    Uses heuristic rules to evaluate orders for potential fraud.
    """

    def check_fraud_batch(self, orders: list[types.Order]) -> list[types.FraudResult]:
        results = []
        for txn in orders:
            is_fraud = False
            if txn.quantity > 100 and txn.user_id.startswith("guest_"):
                is_fraud = True
            if txn.item_id.startswith("SUSP-"):
                is_fraud = True
            if txn.quantity > 500:
                is_fraud = True
            results.append(types.FraudResult(
                order_id=txn.id,
                is_fraud=is_fraud,
            ))
        return results
