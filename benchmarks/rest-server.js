#!/usr/bin/env node
/**
 * REST Server (HTTP/1.1) — Express.js
 * Implements the same PolyERP pipeline as the Wasm component,
 * served over REST endpoints for fair latency/throughput comparison.
 */

const express = require('express');
const { processPipeline, getStock, SKU_CATALOG } = require('./pipeline');

const app = express();
app.use(express.json({ limit: '50mb' }));

// POST /pipeline — Process a batch of orders
app.post('/pipeline', (req, res) => {
  const { orders } = req.body;
  if (!Array.isArray(orders)) return res.status(400).json({ error: 'orders array required' });
  const result = processPipeline(orders);
  res.json(result);
});

// GET /stock?ids=WH0-SKU-0000,WH0-SKU-0001
app.get('/stock', (req, res) => {
  const ids = (req.query.ids || '').split(',').filter(Boolean);
  res.json({ stock: ids.length ? getStock(ids) : getStock(SKU_CATALOG) });
});

// GET /health
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 18080;
const server = app.listen(PORT, () => {
  console.error(`[REST] Listening on http://127.0.0.1:${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => server.close());
process.on('SIGINT', () => { server.close(); process.exit(0); });
