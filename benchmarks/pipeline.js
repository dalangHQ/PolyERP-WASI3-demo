/**
 * Shared pipeline logic for all benchmark servers.
 * Mirrors the exact same business rules as:
 *   - Rust inventory: process_orders_batch, get_stock
 *   - Python fraud: check_fraud_batch
 *   - TS gateway: processPipeline orchestration
 */

// ── Inventory DB (same as Rust component) ──────────────────────
const inventoryDB = new Map();
for (let w = 0; w < 5; w++) {
  for (let i = 0; i < 10; i++) {
    const sku = `WH${w}-SKU-${String(i).padStart(4, '0')}`;
    inventoryDB.set(sku, 10_000_000 + w * 8_000_000 + i * 500_000);
  }
}
inventoryDB.set('ITEM-99', 10_000_000);
inventoryDB.set('ITEM-42', 5_000_000);
inventoryDB.set('ITEM-07', 7_500_000);
inventoryDB.set('ITEM-21', 3_000_000);

// ── Fraud detection (same rules as Python component) ───────────
const FRAUD_USER_PREFIXES = ['guest_', 'bot_', 'spam_'];
const FRAUD_SKU_PREFIXES = ['SUSP-', 'FRAUD-', 'HOLD-'];
const HIGH_QTY_THRESHOLD = 500;
const SUSPICIOUS_QTY_THRESHOLD = 100;

function checkFraudBatch(orders) {
  return orders.map(order => {
    let isFraud = false;
    if (order.quantity > HIGH_QTY_THRESHOLD) isFraud = true;
    if (!isFraud && order.quantity > SUSPICIOUS_QTY_THRESHOLD) {
      for (const prefix of FRAUD_USER_PREFIXES) {
        if (order.userId.startsWith(prefix)) { isFraud = true; break; }
      }
    }
    if (!isFraud) {
      for (const prefix of FRAUD_SKU_PREFIXES) {
        if (order.itemId.startsWith(prefix)) { isFraud = true; break; }
      }
    }
    if (!isFraud && order.userId.startsWith('bot_')) isFraud = true;
    return { orderId: order.id, isFraud };
  });
}

// ── Inventory processing (same as Rust component) ─────────────
function processOrdersBatch(orders) {
  return orders.map(order => {
    const current = inventoryDB.get(order.itemId) || 0;
    const newStock = Math.max(0, current - order.quantity);
    inventoryDB.set(order.itemId, newStock);
    return { itemId: order.itemId, newStock };
  });
}

// ── Full pipeline (same as gateway) ───────────────────────────
function processPipeline(orders) {
  const fraudResults = checkFraudBatch(orders);
  const fraudMap = new Map(fraudResults.map(r => [r.orderId, r.isFraud]));
  const validOrders = orders.filter(o => !fraudMap.get(o.id));
  return { updates: processOrdersBatch(validOrders), fraudCount: fraudResults.filter(r => r.isFraud).length };
}

function getStock(itemIds) {
  return itemIds.map(id => inventoryDB.get(id) || 0);
}

module.exports = { processPipeline, processOrdersBatch, checkFraudBatch, getStock, inventoryDB, SKU_CATALOG: [...inventoryDB.keys()] };
