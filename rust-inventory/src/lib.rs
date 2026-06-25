wit_bindgen::generate!({
    world: "inventory-service",
    path: "../wit",
});

use exports::demo::poly_erp::inventory::Guest;
use demo::poly_erp::types::{InventoryUpdate, Order};
use lazy_static::lazy_static;
use std::collections::HashMap;
use std::sync::Mutex;

/// Massive-scale inventory database: 50 SKUs across 5 warehouses.
/// Each warehouse has 10 SKUs with starting stock of 10M-50M units
/// to sustain high-volume data flow benchmarks.
lazy_static! {
    static ref DB: Mutex<HashMap<String, u32>> = Mutex::new({
        let mut m = HashMap::new();
        // 5 warehouses × 10 SKUs = 50 items
        for w in 0..5u32 {
            for i in 0..10u32 {
                let sku = format!("WH{}-SKU-{:04}", w, i);
                // Stock ranges from 10M to 50M units — massive inventory
                let base_stock: u32 = 10_000_000 + (w * 8_000_000) + (i * 500_000);
                m.insert(sku, base_stock);
            }
        }
        // Keep legacy items for backward compatibility with existing tests
        m.insert("ITEM-99".to_string(), 10_000_000);
        m.insert("ITEM-42".to_string(), 5_000_000);
        m.insert("ITEM-07".to_string(), 7_500_000);
        m.insert("ITEM-21".to_string(), 3_000_000);
        m
    });
}

struct Component;

impl Guest for Component {
    /// Process a massive batch of orders. Optimized for high-throughput:
    /// - Pre-allocates result vector
    /// - Single lock acquisition for the entire batch
    /// - Bulk deduction with overflow protection
    fn process_orders_batch(orders: Vec<Order>) -> Vec<InventoryUpdate> {
        let mut updates = Vec::with_capacity(orders.len());
        let mut db = DB.lock().unwrap();
        for order in orders {
            let current_stock = db.get(&order.item_id).copied().unwrap_or(0);
            let new_stock = current_stock.saturating_sub(order.quantity);
            db.insert(order.item_id.clone(), new_stock);
            updates.push(InventoryUpdate {
                item_id: order.item_id,
                new_stock,
            });
        }
        updates
    }

    /// Bulk stock lookup for the full SKU catalog.
    fn get_stock(item_ids: Vec<String>) -> Vec<u32> {
        let db = DB.lock().unwrap();
        item_ids.iter().map(|id| db.get(id).copied().unwrap_or(0)).collect()
    }
}

export!(Component);
