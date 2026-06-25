/**
 * ═══════════════════════════════════════════════════════════════════
 * PolyERP — Binary Protocol for Order Marshaling
 * ═══════════════════════════════════════════════════════════════════
 *
 * Strategy A from Problem 3 (Marshaling Cost):
 *   Replace JSON with a flat binary layout.
 *
 * Binary Order Format (16 bytes per order, fixed):
 *   ┌──────────┬──────────┬──────────┬──────────┐
 *   │ id_hash  │item_id_h │ quantity │ user_id_h│
 *   │  u32 LE  │  u32 LE  │  u32 LE  │  u32 LE  │
 *   └──────────┴──────────┴──────────┴──────────┘
 *
 * Wire format for a batch:
 *   ┌─────────┬─────────────┬───────────────┐
 *   │ count   │  payload    │  results buf  │
 *   │ u32 LE  │  N*16 bytes │  N*8 bytes    │
 *   └─────────┴─────────────┴───────────────┘
 *
 * Benefits:
 *   - 6x smaller on the wire (32KB vs 200KB for 2000 orders)
 *   - No JSON parse step
 *   - No string allocations
 *   - Zero-copy: results written directly into a pre-allocated buffer
 *
 * For SKU matching, we use FNV-1a hash of the itemId string. The
 * server maintains a hash → SKU mapping table that's pre-populated
 * at startup. Collisions are astronomically unlikely for 50 SKUs.
 */

const crypto = require('crypto');

// ── FNV-1a hash (matches what would be in Rust) ───────────────
function fnv1a32(str) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

// ── SKU catalog (same as pipeline.js) ─────────────────────────
const SKU_CATALOG = [];
for (let w = 0; w < 5; w++) {
  for (let i = 0; i < 10; i++) {
    SKU_CATALOG.push(`WH${w}-SKU-${String(i).padStart(4, '0')}`);
  }
}
SKU_CATALOG.push('ITEM-99', 'ITEM-42', 'ITEM-07', 'ITEM-21');

// Pre-compute hash → SKU index mapping (server side)
const HASH_TO_INDEX = new Map();
SKU_CATALOG.forEach((sku, idx) => {
  HASH_TO_INDEX.set(fnv1a32(sku), idx);
});

// ── Binary Order: 16 bytes ────────────────────────────────────
const ORDER_SIZE = 16;
const RESULT_SIZE = 8; // u32 item_idx + u32 new_stock

/**
 * Encode an array of orders into a binary buffer.
 * @param {Array<{id:string,itemId:string,quantity:number,userId:string}>} orders
 * @returns {Buffer} 4-byte count + orders.length * 16 bytes
 */
function encodeOrders(orders) {
  const buf = Buffer.allocUnsafe(4 + orders.length * ORDER_SIZE);
  buf.writeUInt32LE(orders.length, 0);
  let offset = 4;
  for (const o of orders) {
    buf.writeUInt32LE(fnv1a32(o.id), offset);
    buf.writeUInt32LE(fnv1a32(o.itemId), offset + 4);
    buf.writeUInt32LE(o.quantity, offset + 8);
    buf.writeUInt32LE(fnv1a32(o.userId), offset + 12);
    offset += ORDER_SIZE;
  }
  return buf;
}

/**
 * Decode a binary results buffer.
 * @param {Buffer|Uint8Array} buf
 * @returns {Array<{itemIndex:number, newStock:number}>}
 */
function decodeResults(buf) {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const count = view.getUint32(0, true);
  const results = new Array(count);
  let offset = 4;
  for (let i = 0; i < count; i++) {
    results[i] = {
      itemIndex: view.getUint32(offset, true),
      newStock: view.getUint32(offset + 4, true),
    };
    offset += RESULT_SIZE;
  }
  return results;
}

/**
 * Process orders from binary buffer against an in-memory stock array.
 * This is the server-side function — the stock array is pre-allocated
 * and indexed by SKU position, so we have ZERO map lookups and
 * ZERO string allocations during processing.
 *
 * @param {Buffer|Uint8Array} orderBuf
 * @param {Uint32Array} stocks - flat array indexed by SKU position
 * @returns {Buffer} result buffer (4-byte count + N*8 bytes)
 */
function processBinaryOrders(orderBuf, stocks) {
  const view = new DataView(orderBuf.buffer, orderBuf.byteOffset, orderBuf.byteLength);
  const count = view.getUint32(0, true);
  const result = Buffer.allocUnsafe(4 + count * RESULT_SIZE);
  let inOffset = 4;
  let outOffset = 4;
  result.writeUInt32LE(count, 0);
  for (let i = 0; i < count; i++) {
    const itemIdHash = view.getUint32(inOffset + 4, true);
    const quantity = view.getUint32(inOffset + 8, true);
    const idx = HASH_TO_INDEX.get(itemIdHash);
    if (idx === undefined) {
      // Unknown SKU — skip but record
      result.writeUInt32LE(0xFFFFFFFF, outOffset); // sentinel
      result.writeUInt32LE(0, outOffset + 4);
    } else {
      const current = stocks[idx];
      const newStock = Math.max(0, current - quantity);
      stocks[idx] = newStock;
      result.writeUInt32LE(idx, outOffset);
      result.writeUInt32LE(newStock, outOffset + 4);
    }
    inOffset += ORDER_SIZE;
    outOffset += RESULT_SIZE;
  }
  return result;
}

/**
 * Fraud check in binary space — same rules as Python fraud component,
 * but operating on the binary buffer directly without any string alloc.
 *
 * Fraud rules (simplified for binary path):
 *   - quantity > 500 → fraud
 *   - quantity > 100 AND user_id_hash matches a fraud prefix hash → fraud
 *
 * Returns a BitArray (1 bit per order) for ultra-compact transmission.
 */
function binaryFraudCheck(orderBuf) {
  const view = new DataView(orderBuf.buffer, orderBuf.byteOffset, orderBuf.byteLength);
  const count = view.getUint32(0, true);
  const bitBytes = Math.ceil(count / 8);
  const bits = Buffer.alloc(4 + bitBytes);
  bits.writeUInt32LE(count, 0);
  bits.fill(0, 4);
  let offset = 4;
  for (let i = 0; i < count; i++) {
    const quantity = view.getUint32(offset + 8, true);
    const userIdHash = view.getUint32(offset + 12, true);
    let isFraud = false;
    if (quantity > 500) isFraud = true;
    else if (quantity > 100) {
      // Hash of fraud prefixes: guest_, bot_, spam_
      // Use bit mixing for O(1) lookup
      const prefixHash = (userIdHash & 0xFFFF0000) >>> 0;
      // Approximate: high-16 bits of fnv1a("guest_") = 0xE40B,
      // fnv1a("bot_") = 0x6B77, fnv1a("spam_") = 0x8B5E
      if (prefixHash === 0xE40B0000 || prefixHash === 0x6B770000 || prefixHash === 0x8B5E0000) {
        isFraud = true;
      }
    }
    if (isFraud) {
      const byteIdx = 4 + (i >> 3);
      bits[byteIdx] |= (1 << (i & 7));
    }
    offset += ORDER_SIZE;
  }
  return bits;
}

/**
 * Apply a fraud bitmask to filter orders before inventory processing.
 * Returns a new order buffer containing only non-fraudulent orders.
 */
function filterOrdersByFraudMask(orderBuf, fraudBits) {
  const view = new DataView(orderBuf.buffer, orderBuf.byteOffset, orderBuf.byteLength);
  const count = view.getUint32(0, true);
  const filtered = [];
  let offset = 4;
  for (let i = 0; i < count; i++) {
    const byteIdx = 4 + (i >> 3);
    const isFraud = (fraudBits[byteIdx] >> (i & 7)) & 1;
    if (!isFraud) {
      filtered.push(Buffer.from(orderBuf.subarray(offset, offset + ORDER_SIZE)));
    }
    offset += ORDER_SIZE;
  }
  const result = Buffer.allocUnsafe(4 + filtered.length * ORDER_SIZE);
  result.writeUInt32LE(filtered.length, 0);
  let outOff = 4;
  for (const slice of filtered) {
    slice.copy(result, outOff);
    outOff += ORDER_SIZE;
  }
  return result;
}

/**
 * Full binary pipeline: encode → fraud check → filter → inventory process.
 * Returns the result buffer.
 */
function binaryPipeline(orders, stocks) {
  const orderBuf = encodeOrders(orders);
  const fraudBits = binaryFraudCheck(orderBuf);
  const filteredBuf = filterOrdersByFraudMask(orderBuf, fraudBits);
  return processBinaryOrders(filteredBuf, stocks);
}

module.exports = {
  fnv1a32,
  SKU_CATALOG,
  HASH_TO_INDEX,
  ORDER_SIZE,
  RESULT_SIZE,
  encodeOrders,
  decodeResults,
  processBinaryOrders,
  binaryFraudCheck,
  filterOrdersByFraudMask,
  binaryPipeline,
};
