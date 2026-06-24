#[allow(warnings)]
mod bindings;

use bindings::exports::demo::poly_erp::inventory::Guest;
use bindings::demo::poly_erp::types::{InventoryUpdate, Order};
use lazy_static::lazy_static;
use std::collections::HashMap;
use std::sync::Mutex;

// Simulate an in-memory, high-speed key-value store for our inventory
lazy_static! {
    static ref DB: Mutex<HashMap<String, u32>> = Mutex::new({
        let mut m = HashMap::new();
        m.insert("ITEM-99".to_string(), 1_000_000); // Start with 1 million items
        m.insert("ITEM-42".to_string(), 500_000);
        m.insert("ITEM-07".to_string(), 750_000);
        m.insert("ITEM-21".to_string(), 300_000);
        m
    });
}

struct Component;

impl Guest for Component {
    /// Process a batch of orders and return inventory updates.
    /// For each order, deduct stock from the in-memory DB if available.
    fn process_orders(orders: Vec<Order>) -> Vec<InventoryUpdate> {
        let mut updates = Vec::with_capacity(orders.len());
        let mut db = DB.lock().unwrap();

        for order in orders {
            let current_stock = db.get(&order.item_id).cloned().unwrap_or(0);

            let new_stock = if current_stock >= order.quantity {
                current_stock - order.quantity
            } else {
                current_stock // Insufficient stock, ignore deduction
            };

            db.insert(order.item_id.clone(), new_stock);

            updates.push(InventoryUpdate {
                item_id: order.item_id,
                new_stock,
            });
        }

        updates
    }

    /// Get current stock levels for requested items
    fn get_stock(item_ids: Vec<String>) -> Vec<u32> {
        let db = DB.lock().unwrap();
        item_ids
            .iter()
            .map(|id| db.get(id).cloned().unwrap_or(0))
            .collect()
    }
}

// Register the component implementation
bindings::export!(Component with_types_in bindings);
