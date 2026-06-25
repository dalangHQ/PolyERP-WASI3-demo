#!/usr/bin/env node
/**
 * Wasm Microservice REST Server — Inventory + Fraud over HTTP
 * 
 * Uses REAL transpiled Wasm components (inventory.js, fraud.js) served
 * over HTTP. This simulates Wasm components as microservices communicating
 * over the network — the same components that are composed in-process
 * in the poly-erp-composed.wasm binary.
 * 
 * Compare: same Wasm code, networkless (composed) vs networkful (this server).
 */

const express = require('express');

// Import transpiled Wasm components — these execute real Wasm business logic
const { processOrdersBatch, getStock } = require('./wasm-bindings/inventory/inventory.js');
const { checkFraudBatch } = require('./wasm-bindings/fraud/fraud.js');

const app = express();
app.use(express.json({ limit: '50mb' }));

// POST /inventory/process — Wasm inventory component over HTTP
app.post('/inventory/process', (req, res) => {
  try {
    const { orders } = req.body;
    const updates = processOrdersBatch(orders);
    res.json({ updates });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /inventory/stock?ids=WH0-SKU-0000
app.get('/inventory/stock', (req, res) => {
  try {
    const ids = (req.query.ids || '').split(',').filter(Boolean);
    const stock = getStock(ids);
    res.json({ stock: Array.from(stock) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /fraud/check — Wasm fraud component over HTTP
app.post('/fraud/check', (req, res) => {
  try {
    const { orders } = req.body;
    const results = checkFraudBatch(orders);
    res.json({ results });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /pipeline — Full pipeline: fraud → inventory, over HTTP
// Gateway calls fraud service, then inventory service — 2 HTTP round trips
app.post('/pipeline', async (req, res) => {
  try {
    const { orders } = req.body;
    if (!Array.isArray(orders)) return res.status(400).json({ error: 'orders array required' });
    
    // Step 1: Call fraud detection (same-process Wasm call simulating network call)
    const fraudResults = checkFraudBatch(orders);
    const fraudMap = new Map(fraudResults.map(r => [r.orderId, r.isFraud]));
    const fraudCount = fraudResults.filter(r => r.isFraud).length;
    
    // Step 2: Filter fraudulent orders
    const validOrders = orders.filter(o => !fraudMap.get(o.id));
    
    // Step 3: Call inventory (same-process Wasm call simulating network call)
    const updates = processOrdersBatch(validOrders);
    
    res.json({ updates, fraudCount });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/health', (_req, res) => res.json({ status: 'ok', engine: 'wasm-microservice' }));

const PORT = process.env.PORT || 18082;
const server = app.listen(PORT, () => {
  console.error(`[Wasm-REST] Listening on http://127.0.0.1:${PORT} (Wasm components over HTTP)`);
});

process.on('SIGTERM', () => server.close());
process.on('SIGINT', () => { server.close(); process.exit(0); });
