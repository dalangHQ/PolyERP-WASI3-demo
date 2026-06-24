import { gatewayApi } from './composed-js/poly-erp-composed.js';

console.log("=== PolyERP WASI 0.3 Component Blackbox QA ===\n");
let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); passed++; }
  catch (e) { console.log(`  ✗ ${name}: ${e.message}`); failed++; }
}

test("getTelemetry returns 4 architecture benchmarks", () => {
  const t = gatewayApi.getTelemetry();
  if (t.length !== 4) throw new Error(`Expected 4, got ${t.length}`);
});

test("Wasm Component has lowest latency", () => {
  const t = gatewayApi.getTelemetry();
  const wasm = t.find(x => x.architecture === "Wasm Component");
  const rest = t.find(x => x.architecture === "REST (Network IPC)");
  if (wasm.latencyNs >= rest.latencyNs) throw new Error("Wasm should be faster than REST");
});

test("Wasm Component has highest throughput", () => {
  const t = gatewayApi.getTelemetry();
  const wasm = t.find(x => x.architecture === "Wasm Component");
  const rest = t.find(x => x.architecture === "REST (Network IPC)");
  if (wasm.throughputMsgSec <= rest.throughputMsgSec) throw new Error("Wasm throughput should be higher");
});

test("processPipeline processes valid orders", () => {
  const orders = [
    { id: "QA-001", itemId: "ITEM-99", quantity: 5, userId: "user_test" },
    { id: "QA-002", itemId: "ITEM-42", quantity: 3, userId: "user_test2" },
  ];
  const updates = gatewayApi.processPipeline(orders);
  if (updates.length === 0) throw new Error("Expected updates");
});

test("processPipeline filters fraudulent orders", () => {
  const orders = [
    { id: "QA-F1", itemId: "ITEM-99", quantity: 200, userId: "guest_bad" },
    { id: "QA-OK", itemId: "ITEM-99", quantity: 1, userId: "user_good" },
  ];
  const updates = gatewayApi.processPipeline(orders);
  if (updates.length !== 1) throw new Error(`Expected 1 update, got ${updates.length}`);
});

test("getStock returns stock levels", () => {
  const stock = gatewayApi.getStock(["ITEM-99", "ITEM-42"]);
  if (stock.length !== 2) throw new Error(`Expected 2, got ${stock.length}`);
});

test("processPipeline handles empty orders", () => {
  const updates = gatewayApi.processPipeline([]);
  if (updates.length !== 0) throw new Error(`Expected 0, got ${updates.length}`);
});

test("Telemetry timestamps are recent", () => {
  const t = gatewayApi.getTelemetry();
  const now = Date.now();
  for (const x of t) {
    if (Math.abs(Number(x.timestamp) - now) > 5000) throw new Error("Timestamp too far");
  }
});

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
process.exit(failed > 0 ? 1 : 0);
