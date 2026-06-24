wit_bindgen::generate!({
    world: "inventory-service",
    path: "../wit",
    async: ["demo:poly-erp/inventory@1.0.0#process-orders"],
});

use exports::demo::poly_erp::inventory::Guest;
use demo::poly_erp::types::{InventoryUpdate, Order};
use lazy_static::lazy_static;
use std::collections::HashMap;
use tokio::sync::Mutex;

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
    /// Takes an infinite stream of Orders, processes them asynchronously,
    /// and returns an infinite stream of InventoryUpdates.
    async fn process_orders(
        mut incoming: wit_bindgen::rt::async_support::StreamReader<Order>,
    ) -> wit_bindgen::rt::async_support::StreamReader<InventoryUpdate> {
        let (mut writer, reader) = wit_stream::new::<InventoryUpdate>();

        // Spawn an async task using the wit-bindgen async runtime
        wit_bindgen::rt::async_support::spawn_local(async move {
            // Use the low-level read API directly on StreamReader
            loop {
                // Read one order at a time
                let buf = Vec::with_capacity(1);
                let (result, orders) = incoming.read(buf).await;
                
                match result {
                    wit_bindgen::rt::async_support::StreamResult::Complete(0) => continue,
                    wit_bindgen::rt::async_support::StreamResult::Complete(n) => {
                        for order in &orders[..n] {
                            let mut db = DB.lock().await;
                            let current_stock = db.get(&order.item_id).cloned().unwrap_or(0);
                            
                            let new_stock = if current_stock >= order.quantity {
                                current_stock - order.quantity
                            } else {
                                current_stock
                            };
                            
                            db.insert(order.item_id.clone(), new_stock);
                            drop(db);
                            
                            let update = InventoryUpdate {
                                item_id: order.item_id.clone(),
                                new_stock,
                            };
                            
                            let (wresult, _) = writer.write(vec![update]).await;
                            if matches!(wresult, wit_bindgen::rt::async_support::StreamResult::Dropped) {
                                return;
                            }
                        }
                    }
                    wit_bindgen::rt::async_support::StreamResult::Dropped => break,
                    wit_bindgen::rt::async_support::StreamResult::Cancelled => continue,
                }
            }
        });

        reader
    }
}

export!(Component);
