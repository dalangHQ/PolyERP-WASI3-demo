#!/usr/bin/env node
/**
 * Wasm Microservice TCP Server — Inventory + Fraud over raw TCP
 * 
 * Same Wasm components, but served over TCP (JSON-RPC protocol).
 * Simulates Wasm microservices communicating over network sockets.
 */

const net = require('net');
const { processOrdersBatch, getStock } = require('./wasm-bindings/inventory/inventory.js');
const { checkFraudBatch } = require('./wasm-bindings/fraud/fraud.js');
const SKU_CATALOG = [];
for (let w = 0; w < 5; w++) for (let i = 0; i < 10; i++) SKU_CATALOG.push(`WH${w}-SKU-${String(i).padStart(4, '0')}`);

const server = net.createServer((socket) => {
  let buffer = '';
  socket.on('data', (data) => {
    buffer += data.toString();
    let idx;
    while ((idx = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, idx).trim();
      buffer = buffer.slice(idx + 1);
      if (!line) continue;
      try {
        const msg = JSON.parse(line);
        let result;
        if (msg.method === 'pipeline') {
          const orders = msg.params.orders;
          const fraudResults = checkFraudBatch(orders);
          const fraudMap = new Map(fraudResults.map(r => [r.orderId, r.isFraud]));
          const validOrders = orders.filter(o => !fraudMap.get(o.id));
          const updates = processOrdersBatch(validOrders);
          result = { updates, fraudCount: fraudResults.filter(r => r.isFraud).length };
        } else if (msg.method === 'stock') {
          result = { stock: Array.from(getStock(msg.params?.ids || SKU_CATALOG)) };
        } else if (msg.method === 'health') {
          result = { status: 'ok', engine: 'wasm-tcp' };
        } else {
          socket.write(JSON.stringify({ error: 'unknown method', id: msg.id }) + '\n');
          continue;
        }
        socket.write(JSON.stringify({ result, id: msg.id }) + '\n');
      } catch (e) {
        socket.write(JSON.stringify({ error: e.message, id: null }) + '\n');
      }
    }
  });
  socket.on('error', () => {});
});

const PORT = process.env.PORT || 18083;
server.listen(PORT, '127.0.0.1', () => {
  console.error(`[Wasm-TCP] Listening on tcp://127.0.0.1:${PORT} (Wasm components over TCP)`);
});
process.on('SIGTERM', () => server.close());
process.on('SIGINT', () => { server.close(); process.exit(0); });
