/**
 * Blackbox QA test for the composed PolyERP component.
 * Tests all exported functions of the gateway-api interface.
 */

import { gatewayApi } from './composed-js/poly-erp-composed.js';

console.log("=== PolyERP WASI 0.3 Component Blackbox QA ===\n");

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (e) {
    console.log(`  ✗ ${name}: ${e.message}`);
    failed++;
  }
}

// Test 1: get-telemetry
test("getTelemetry returns 4 architecture benchmarks", () => {
  const telemetry = gatewayApi.getTelemetry();
  if (telemetry.length !== 4) throw new Error(`Expected 4, got ${telemetry.length}`);
  const names = telemetry.map(t => t.architecture);
  if (!names.includes("Wasm Component")) throw new Error("Missing Wasm Component");
  if (!names.includes("REST (Network IPC)")) throw new Error("Missing REST");
  if (!names.includes("FFI (Unsafe C-Boundary)")) throw new Error("Missing FFI");
  if (!names.includes("JSON-RPC (stdio Pipe)")) throw new Error("Missing JSON-RPC");
});

// Test 2: Wasm Component should have lowest latency
test("Wasm Component has lowest latency", () => {
  const telemetry = gatewayApi.getTelemetry();
  const wasm = telemetry.find(t => t.architecture === "Wasm Component");
  const rest = telemetry.find(t => t.architecture === "REST (Network IPC)");
  if (wasm.latencyNs >= rest.latencyNs) throw new Error("Wasm should be faster than REST");
});

// Test 3: Wasm Component should have highest throughput
test("Wasm Component has highest throughput", () => {
  const telemetry = gatewayApi.getTelemetry();
  const wasm = telemetry.find(t => t.architecture === "Wasm Component");
  const rest = telemetry.find(t => t.architecture === "REST (Network IPC)");
  if (wasm.throughputMsgSec <= rest.throughputMsgSec) throw new Error("Wasm should have higher throughput than REST");
});

// Test 4: process-pipeline with valid orders
test("processPipeline processes valid orders", () => {
  const orders = [
    { id: "QA-001", itemId: "ITEM-99", quantity: 5, userId: "user_test" },
    { id: "QA-002", itemId: "ITEM-42", quantity: 3, userId: "user_test2" },
  ];
  const updates = gatewayApi.processPipeline(orders);
  if (updates.length === 0) throw new Error("Expected updates, got empty list");
  const hasItem99 = updates.some(u => u.itemId === "ITEM-99");
  if (!hasItem99) throw new Error("Missing ITEM-99 update");
});

// Test 5: process-pipeline filters fraudulent orders
test("processPipeline filters fraudulent orders (high qty + guest)", () => {
  const orders = [
    { id: "QA-FRAUD-001", itemId: "ITEM-99", quantity: 200, userId: "guest_bad" },
    { id: "QA-OK-001", itemId: "ITEM-99", quantity: 1, userId: "user_good" },
  ];
  const updates = gatewayApi.processPipeline(orders);
  // Only the non-fraud order should result in an inventory update
  if (updates.length !== 1) throw new Error(`Expected 1 update, got ${updates.length}`);
  if (updates[0].itemId !== "ITEM-99") throw new Error("Wrong item updated");
});

// Test 6: get-stock returns stock levels
test("getStock returns stock levels", () => {
  const stock = gatewayApi.getStock(["ITEM-99", "ITEM-42"]);
  if (stock.length !== 2) throw new Error(`Expected 2 stock levels, got ${stock.length}`);
  if (stock[0] === 0 && stock[1] === 0) throw new Error("Stock levels shouldn't both be 0");
});

// Test 7: process-pipeline handles empty order list
test("processPipeline handles empty order list", () => {
  const updates = gatewayApi.processPipeline([]);
  if (updates.length !== 0) throw new Error(`Expected 0 updates, got ${updates.length}`);
});

// Test 8: Telemetry timestamps are reasonable
test("Telemetry timestamps are recent", () => {
  const telemetry = gatewayApi.getTelemetry();
  const now = Date.now();
  for (const t of telemetry) {
    const diff = Math.abs(Number(t.timestamp) - now);
    if (diff > 5000) throw new Error(`Timestamp too far from now: ${diff}ms`);
  }
});

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
process.exit(failed > 0 ? 1 : 0);
