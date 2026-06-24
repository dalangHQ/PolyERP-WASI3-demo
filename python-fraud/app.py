"""
PolyERP Fraud Detection Component

Implements the fraud-detection interface from our WIT definition.
Evaluates orders for fraud patterns using configurable heuristics.
"""

from wit_world import exports
from wit_world.imports import types


class FraudDetection(exports.FraudDetection):
    """
    Implements the `fraud-detection` interface exported by our `fraud-service` world.
    Uses heuristic rules to evaluate orders for potential fraud.
    """

    def check_fraud(self, orders: list[types.Order]) -> list[types.FraudResult]:
        """
        Evaluate a batch of orders for fraud patterns.
        
        Fraud heuristics:
        1. High quantity orders (>100 units) from guest accounts are flagged
        2. Orders with item-id starting with "SUSP-" are flagged
        3. Orders where quantity exceeds 500 are always flagged regardless of user
        """
        results = []
        for txn in orders:
            is_fraud = False
            
            # Rule 1: High quantity from guest accounts
            if txn.quantity > 100 and txn.user_id.startswith("guest_"):
                is_fraud = True
            
            # Rule 2: Suspicious item IDs
            if txn.item_id.startswith("SUSP-"):
                is_fraud = True
            
            # Rule 3: Extremely high quantity regardless of user
            if txn.quantity > 500:
                is_fraud = True
            
            results.append(types.FraudResult(
                order_id=txn.id,
                is_fraud=is_fraud,
            ))
        
        return results
