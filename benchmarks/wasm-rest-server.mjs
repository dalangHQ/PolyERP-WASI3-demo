#!/usr/bin/env node
/**
 * Wasm Microservice REST Server — Inventory + Fraud over HTTP
 * Uses REAL transpiled Wasm components served over HTTP.
 * Same Wasm business logic as the composed binary, but over the network.
 */

import express from 'express';
import { inventory as invNs } from './wasm-bindings/inventory/inventory.mjs';
import { fraudDetection as fraudNs } from './wasm-bindings/fraud/fraud.mjs';

const { processOrdersBatch, getStock, getMemoryStats } = invNs;
const { checkFraudBatch } = fraudNs;

const app = express();
app.use(express.json({ limit: '50mb' }));

app.post('/inventory/process', (req, res) => {
  try {
    const updates = processOrdersBatch(req.body.orders);
    res.json({ updates });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/inventory/stock', (req, res) => {
  try {
    const ids = (req.query.ids || '').split(',').filter(Boolean);
    const stock = getStock(ids);
    res.json({ stock: Array.from(stock) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/fraud/check', (req, res) => {
  try {
    const results = checkFraudBatch(req.body.orders);
    res.json({ results });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/pipeline', (req, res) => {
  try {
    const { orders } = req.body;
    if (!Array.isArray(orders)) return res.status(400).json({ error: 'orders array required' });
    const fraudResults = checkFraudBatch(orders);
    const fraudMap = new Map(fraudResults.map(r => [r.orderId, r.isFraud]));
    const validOrders = orders.filter(o => !fraudMap.get(o.id));
    const updates = processOrdersBatch(validOrders);
    res.json({ updates, fraudCount: fraudResults.filter(r => r.isFraud).length });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/health', (_req, res) => res.json({ status: 'ok', engine: 'wasm-microservice' }));

const PORT = process.env.PORT || 18082;
app.listen(PORT, () => {
  console.error(`[Wasm-REST] Listening on http://127.0.0.1:${PORT} (Wasm components over HTTP)`);
});

process.on('SIGTERM', () => process.exit(0));
process.on('SIGINT', () => process.exit(0));
