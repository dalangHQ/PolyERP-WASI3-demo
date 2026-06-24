/**
 * Blackbox QA test for PolyERP WASI 0.3 components.
 * Tests the composed (gateway+inventory) and separate fraud component.
 */

// Import the composed gateway+inventory component
import { gatewayApi } from './composed-js/poly-erp-composed.js';
// Import the fraud detection component (separate due to wac limitation)
import { fraudDetection } from './fraud-js/fraud.js';

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

// Test 1: Fraud detection component
test("Fraud: check-fraud-batch flags high-qty guest orders", () => {
  const results = fraudDetection.checkFraudBatch([
    { id: "QA-001", itemId: "ITEM-99", quantity: 200, userId: "guest_bad" },
    { id: "QA-002", itemId: "ITEM-99", quantity: 5, userId: "user_good" },
  ]);
  if (results.length !== 2) throw new Error(`Expected 2 results, got ${results.length}`);
  if (!results[0].isFraud) throw new Error("Guest with qty 200 should be fraud");
  if (results[1].isFraud) throw new Error("Normal user with qty 5 should not be fraud");
});

// Test 2: Fraud detection - extreme quantity
test("Fraud: flags extreme quantity regardless of user", () => {
  const results = fraudDetection.checkFraudBatch([
    { id: "QA-003", itemId: "ITEM-99", quantity: 600, userId: "user_admin" },
  ]);
  if (!results[0].isFraud) throw new Error("Qty 600 should always be fraud");
});

// Test 3: Inventory component via composed gateway
test("Gateway: process-pipeline processes orders", () => {
  const orders = [
    { id: "QA-010", itemId: "ITEM-99", quantity: 5, userId: "user_test" },
    { id: "QA-011", itemId: "ITEM-42", quantity: 3, userId: "user_test2" },
  ];
  const updates = gatewayApi.processPipeline(orders);
  if (updates.length === 0) throw new Error("Expected updates, got empty list");
});

// Test 4: get-telemetry from composed component
test("Gateway: get-telemetry returns 4 architecture benchmarks", () => {
  const telemetry = gatewayApi.getTelemetry();
  if (telemetry.length !== 4) throw new Error(`Expected 4, got ${telemetry.length}`);
  const names = telemetry.map(t => t.architecture);
  if (!names.includes("Wasm Component")) throw new Error("Missing Wasm Component");
  if (!names.includes("REST (Network IPC)")) throw new Error("Missing REST");
});

// Test 5: Wasm Component should have lowest latency
test("Telemetry: Wasm Component has lowest latency", () => {
  const telemetry = gatewayApi.getTelemetry();
  const wasm = telemetry.find(t => t.architecture === "Wasm Component");
  const rest = telemetry.find(t => t.architecture === "REST (Network IPC)");
  if (wasm.latencyNs >= rest.latencyNs) throw new Error("Wasm should be faster than REST");
});

// Test 6: get-stock from composed component
test("Gateway: get-stock returns stock levels", () => {
  const stock = gatewayApi.getStock(["ITEM-99", "ITEM-42"]);
  if (stock.length !== 2) throw new Error(`Expected 2, got ${stock.length}`);
});

// Test 7: process-pipeline handles empty orders
test("Gateway: process-pipeline handles empty orders", () => {
  const updates = gatewayApi.processPipeline([]);
  if (updates.length !== 0) throw new Error(`Expected 0 updates, got ${updates.length}`);
});

// Test 8: Telemetry timestamps are recent
test("Telemetry: timestamps are recent", () => {
  const telemetry = gatewayApi.getTelemetry();
  const now = Date.now();
  for (const t of telemetry) {
    const diff = Math.abs(Number(t.timestamp) - now);
    if (diff > 5000) throw new Error(`Timestamp too far: ${diff}ms`);
  }
});

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
process.exit(failed > 0 ? 1 : 0);
