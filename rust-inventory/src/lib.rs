wit_bindgen::generate!({
    world: "inventory-service",
    path: "../wit",
});

use exports::demo::poly_erp::inventory::Guest;
use demo::poly_erp::types::{InventoryUpdate, Order};
use lazy_static::lazy_static;
use std::collections::HashMap;
use std::sync::Mutex;

lazy_static! {
    static ref DB: Mutex<HashMap<String, u32>> = Mutex::new({
        let mut m = HashMap::new();
        m.insert("ITEM-99".to_string(), 1_000_000);
        m.insert("ITEM-42".to_string(), 500_000);
        m.insert("ITEM-07".to_string(), 750_000);
        m.insert("ITEM-21".to_string(), 300_000);
        m
    });
}

struct Component;

impl Guest for Component {
    fn process_orders_batch(orders: Vec<Order>) -> Vec<InventoryUpdate> {
        let mut updates = Vec::with_capacity(orders.len());
        let mut db = DB.lock().unwrap();
        for order in orders {
            let current_stock = db.get(&order.item_id).cloned().unwrap_or(0);
            let new_stock = if current_stock >= order.quantity {
                current_stock - order.quantity
            } else {
                current_stock
            };
            db.insert(order.item_id.clone(), new_stock);
            updates.push(InventoryUpdate {
                item_id: order.item_id,
                new_stock,
            });
        }
        updates
    }

    fn get_stock(item_ids: Vec<String>) -> Vec<u32> {
        let db = DB.lock().unwrap();
        item_ids.iter().map(|id| db.get(id).cloned().unwrap_or(0)).collect()
    }
}

export!(Component);
