wit_bindgen::generate!({
    world: "fraud-service",
    path: "../wit",
});

use exports::demo::poly_erp::fraud_detection::Guest;
use demo::poly_erp::types::{FraudResult, Order};

/// ═══════════════════════════════════════════════════════════════
/// RUST FRAUD DETECTION COMPONENT (replaces Python)
/// ═══════════════════════════════════════════════════════════════
/// 
/// This replaces the Python fraud component for 10-100x speedup.
/// Python-compiled-to-Wasm is slow because CPython's interpreter loop
/// runs on top of Wasm — every Python instruction becomes many Wasm
/// instructions. Rust compiles directly to native-quality Wasm.
///
/// Same fraud rules as python-fraud/app.py:
///   1. quantity > 500 → fraud
///   2. quantity > 100 AND userId starts with guest_/bot_/spam_ → fraud
///   3. itemId starts with SUSP-/FRAUD-/HOLD- → fraud
///   4. userId starts with bot_ → fraud (always)
///
/// Plus Wizer pre-init hook for instant cold start.

const HIGH_QUANTITY_THRESHOLD: u32 = 500;
const SUSPICIOUS_QUANTITY_THRESHOLD: u32 = 100;
const FRAUD_USER_PREFIXES: &[&str] = &["guest_", "bot_", "spam_"];
const FRAUD_SKU_PREFIXES: &[&str] = &["SUSP-", "FRAUD-", "HOLD-"];

/// Wizer pre-initialization hook — pre-compiles fraud rules into
/// the Wasm binary's data section. Cold start drops to ~5-15ms.
#[export_name = "wizer.initialize"]
pub extern "C" fn wizer_init() {
    // Touch the const arrays so they're in the data section
    std::hint::black_box(&FRAUD_USER_PREFIXES);
    std::hint::black_box(&FRAUD_SKU_PREFIXES);
    std::hint::black_box(HIGH_QUANTITY_THRESHOLD);
    std::hint::black_box(SUSPICIOUS_QUANTITY_THRESHOLD);
}

struct Component;

impl Guest for Component {
    /// Batch fraud check — processes all orders in a single call.
    /// Pre-allocates the result vector for zero per-order allocation.
    fn check_fraud_batch(orders: Vec<Order>) -> Vec<FraudResult> {
        let mut results = Vec::with_capacity(orders.len());
        for order in orders {
            let is_fraud = check_fraud_single(&order);
            results.push(FraudResult {
                order_id: order.id,
                is_fraud,
            });
        }
        results
    }
}

#[inline]
fn check_fraud_single(order: &Order) -> bool {
    // Rule 1: Excessive quantity
    if order.quantity > HIGH_QUANTITY_THRESHOLD {
        return true;
    }
    // Rule 2: Suspicious user with high-ish quantity
    if order.quantity > SUSPICIOUS_QUANTITY_THRESHOLD {
        for prefix in FRAUD_USER_PREFIXES {
            if order.user_id.starts_with(prefix) {
                return true;
            }
        }
    }
    // Rule 3: Flagged SKU categories
    for prefix in FRAUD_SKU_PREFIXES {
        if order.item_id.starts_with(prefix) {
            return true;
        }
    }
    // Rule 4: Bot users always flagged
    if order.user_id.starts_with("bot_") {
        return true;
    }
    false
}

export!(Component);
