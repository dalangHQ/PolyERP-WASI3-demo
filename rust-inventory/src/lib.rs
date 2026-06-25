wit_bindgen::generate!({
    world: "inventory-service",
    path: "../wit",
});

use exports::demo::poly_erp::inventory::Guest;
use demo::poly_erp::types::{InventoryUpdate, MemoryStats, Order};
use lazy_static::lazy_static;
use std::collections::HashMap;
use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::Mutex;

/// Massive-scale inventory database: 50 SKUs across 5 warehouses.
/// Each warehouse has 10 SKUs with starting stock of 10M-50M units
/// to sustain high-volume data flow benchmarks.
lazy_static! {
    static ref DB: Mutex<HashMap<String, u32>> = Mutex::new({
        let mut m = HashMap::new();
        for w in 0..5u32 {
            for i in 0..10u32 {
                let sku = format!("WH{}-SKU-{:04}", w, i);
                let base_stock: u32 = 10_000_000 + (w * 8_000_000) + (i * 500_000);
                m.insert(sku, base_stock);
            }
        }
        m.insert("ITEM-99".to_string(), 10_000_000);
        m.insert("ITEM-42".to_string(), 5_000_000);
        m.insert("ITEM-07".to_string(), 7_500_000);
        m.insert("ITEM-21".to_string(), 3_000_000);
        m
    });
}

/// Tracking counters for memory benchmarking
static TOTAL_ORDERS_TRACKED: AtomicU32 = AtomicU32::new(0);
static PEAK_BATCH_SIZE: AtomicU32 = AtomicU32::new(0);

struct Component;

impl Guest for Component {
    /// Process a massive batch of orders. Optimized for high-throughput:
    /// - Pre-allocates result vector
    /// - Single lock acquisition for the entire batch
    /// - Bulk deduction with overflow protection (saturating_sub)
    /// - Tracks peak batch size and total orders for memory stats
    fn process_orders_batch(orders: Vec<Order>) -> Vec<InventoryUpdate> {
        let batch_size = orders.len() as u32;
        
        // Track memory stats
        TOTAL_ORDERS_TRACKED.fetch_add(batch_size, Ordering::Relaxed);
        
        // Update peak batch size (CAS loop)
        let mut current_peak = PEAK_BATCH_SIZE.load(Ordering::Relaxed);
        while batch_size > current_peak {
            match PEAK_BATCH_SIZE.compare_exchange_weak(
                current_peak, batch_size, Ordering::Relaxed, Ordering::Relaxed
            ) {
                Ok(_) => break,
                Err(actual) => current_peak = actual,
            }
        }
        
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

    /// Return memory statistics from the Rust inventory component.
    /// 
    /// `linear_memory_bytes` estimates the Wasm linear memory footprint:
    ///   - Base overhead: ~64KB (stack, globals, GOT)
    ///   - HashMap: ~120 bytes per entry (key + value + hash overhead)
    ///   - Orders processed contribute to allocation tracking
    fn get_memory_stats() -> MemoryStats {
        let db = DB.lock().unwrap();
        let db_entries = db.len() as u32;
        drop(db); // release lock
        
        // Estimate linear memory footprint
        // Base: 64KB for stack + runtime
        // HashMap: ~120 bytes per live entry (String key ~40 bytes + u32 value + hash metadata)
        // Total orders tracked: each order briefly allocates ~80 bytes during processing
        let base_bytes: u64 = 65_536;
        let db_bytes: u64 = (db_entries as u64) * 120;
        let order_tracking_bytes: u64 = (TOTAL_ORDERS_TRACKED.load(Ordering::Relaxed) as u64) * 8;
        let linear_memory = base_bytes + db_bytes + order_tracking_bytes;
        
        MemoryStats {
            linear_memory_bytes: linear_memory,
            total_orders_tracked: TOTAL_ORDERS_TRACKED.load(Ordering::Relaxed),
            db_entries,
            peak_batch_size: PEAK_BATCH_SIZE.load(Ordering::Relaxed),
        }
    }
}

export!(Component);
