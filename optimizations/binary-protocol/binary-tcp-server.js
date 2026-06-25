#!/usr/bin/env node
/**
 * ═══════════════════════════════════════════════════════════════════
 * PolyERP — Binary Protocol TCP Server
 * ═══════════════════════════════════════════════════════════════════
 *
 * Strategy A from Problem 3 (Marshaling Cost):
 *   Eliminate JSON parsing entirely. Use a flat binary wire format.
 *
 * Wire protocol (length-prefixed binary frames):
 *   ┌──────────────┬─────────────────────────────────┐
 *   │ 4 bytes len  │  payload (binary)               │
 *   └──────────────┴─────────────────────────────────┘
 *
 * Payload opcodes (first byte):
 *   0x01 = pipeline — process batch of orders
 *   0x02 = stock    — query stock levels
 *   0x03 = health   — health check
 *   0x04 = reset    — reset inventory DB (for benchmarks)
 *
 * For 0x01 (pipeline), payload after opcode is:
 *   4 bytes count + count * 16 bytes (binary orders)
 * Response:
 *   4 bytes result_count + result_count * 8 bytes (idx + new_stock)
 *
 * Compare with JSON-RPC server (jsonrpc-server.js): same logic,
 * but binary protocol eliminates JSON.parse / JSON.stringify.
 */

const net = require('net');
const {
  SKU_CATALOG,
  processBinaryOrders,
  binaryFraudCheck,
  filterOrdersByFraudMask,
} = require('./binary-protocol.js');

// ── Pre-allocated flat stock array (zero-allocation hot path) ──
const INITIAL_STOCK = new Uint32Array(SKU_CATALOG.length);
for (let i = 0; i < SKU_CATALOG.length; i++) {
  const sku = SKU_CATALOG[i];
  const m = sku.match(/^WH(\d)-SKU-(\d{4})$/);
  if (m) {
    const w = parseInt(m[1]);
    const idx = parseInt(m[2]);
    INITIAL_STOCK[i] = 10_000_000 + w * 8_000_000 + idx * 500_000;
  } else if (sku === 'ITEM-99') INITIAL_STOCK[i] = 10_000_000;
  else if (sku === 'ITEM-42') INITIAL_STOCK[i] = 5_000_000;
  else if (sku === 'ITEM-07') INITIAL_STOCK[i] = 7_500_000;
  else if (sku === 'ITEM-21') INITIAL_STOCK[i] = 3_000_000;
}

let stocks = new Uint32Array(INITIAL_STOCK);

function resetStocks() {
  stocks = new Uint32Array(INITIAL_STOCK);
}

function handleFrame(payload) {
  if (payload.length < 1) return Buffer.from([0xFF]); // error
  const op = payload[0];
  const body = payload.subarray(1);

  if (op === 0x01) {
    // Pipeline: fraud-check + filter + inventory process
    const orderBuf = body;
    const fraudBits = binaryFraudCheck(orderBuf);
    const filteredBuf = filterOrdersByFraudMask(orderBuf, fraudBits);
    const result = processBinaryOrders(filteredBuf, stocks);
    return result;
  } else if (op === 0x02) {
    // Stock query: return all stock levels as u32 array
    const buf = Buffer.allocUnsafe(4 + stocks.length * 4);
    buf.writeUInt32LE(stocks.length, 0);
    for (let i = 0; i < stocks.length; i++) {
      buf.writeUInt32LE(stocks[i], 4 + i * 4);
    }
    return buf;
  } else if (op === 0x03) {
    // Health
    return Buffer.from('OK', 'utf8');
  } else if (op === 0x04) {
    // Reset
    resetStocks();
    return Buffer.from('RESET', 'utf8');
  }
  return Buffer.from([0xFE]); // unknown op
}

const server = net.createServer((socket) => {
  let frameBuf = Buffer.alloc(0);
  socket.on('data', (chunk) => {
    frameBuf = Buffer.concat([frameBuf, chunk]);
    // Read frames while we have at least 4 bytes for length + payload
    while (frameBuf.length >= 4) {
      const frameLen = frameBuf.readUInt32LE(0);
      if (frameBuf.length < 4 + frameLen) break; // incomplete
      const payload = frameBuf.subarray(4, 4 + frameLen);
      frameBuf = frameBuf.subarray(4 + frameLen);
      try {
        const result = handleFrame(payload);
        const outFrame = Buffer.allocUnsafe(4 + result.length);
        outFrame.writeUInt32LE(result.length, 0);
        result.copy(outFrame, 4);
        socket.write(outFrame);
      } catch (e) {
        const err = Buffer.from(`ERR: ${e.message}`, 'utf8');
        const outFrame = Buffer.allocUnsafe(4 + err.length);
        outFrame.writeUInt32LE(err.length, 0);
        err.copy(outFrame, 4);
        socket.write(outFrame);
      }
    }
  });
  socket.on('error', () => {});
});

const PORT = parseInt(process.env.PORT || '18090', 10);
server.listen(PORT, '127.0.0.1', () => {
  console.error(`[Binary-TCP] Listening on tcp://127.0.0.1:${PORT} (binary protocol, zero-JSON)`);
});

process.on('SIGTERM', () => server.close());
process.on('SIGINT', () => { server.close(); process.exit(0); });
