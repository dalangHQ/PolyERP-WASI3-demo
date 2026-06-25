#!/usr/bin/env node
/**
 * gRPC Server (HTTP/2 + Protobuf) — @grpc/grpc-js
 * Implements the same PolyERP pipeline for fair comparison.
 */

const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');
const { processPipeline, getStock, SKU_CATALOG } = require('./pipeline');

const PROTO_PATH = path.join(__dirname, 'protos', 'polyerp.proto');
const packageDef = protoLoader.loadSync(PROTO_PATH, { keepCase: true, longs: String, enums: String, defaults: true, oneofs: true });
const polyerp = grpc.loadPackageDefinition(packageDef).polayerp;

function processPipelineRPC(call, callback) {
  const orders = call.request.orders.map(o => ({
    id: o.id, itemId: o.item_id, quantity: o.quantity, userId: o.user_id
  }));
  const result = processPipeline(orders);
  callback(null, {
    updates: result.updates.map(u => ({ item_id: u.itemId, new_stock: u.newStock })),
    fraud_count: result.fraudCount,
  });
}

function getStockRPC(call, callback) {
  const ids = call.request.ids.length ? call.request.ids : SKU_CATALOG;
  callback(null, { stock: getStock(ids) });
}

function healthRPC(call, callback) {
  callback(null, {});
}

const server = new grpc.Server();
server.addService(polyerp.PolyERP.service, {
  ProcessPipeline: processPipelineRPC,
  GetStock: getStockRPC,
  Health: healthRPC,
});

const PORT = process.env.PORT || 50051;
server.bindAsync(`127.0.0.1:${PORT}`, grpc.ServerCredentials.createInsecure(), (err, port) => {
  if (err) { console.error('[gRPC] Failed:', err); process.exit(1); }
  server.start();
  console.error(`[gRPC] Listening on 127.0.0.1:${port}`);
});

process.on('SIGTERM', () => server.forceShutdown());
process.on('SIGINT', () => { server.forceShutdown(); process.exit(0); });
