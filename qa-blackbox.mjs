/**
 * MANUAL BLACKBOX QA — PolyERP WASI 0.3 Composed Component
 * 
 * This test script exercises every exported function with real data,
 * validates return values, checks edge cases, and stress-tests.
 */

import { gatewayApi } from '/tmp/qa-composed/poly-erp-composed.js';

let totalTests = 0;
let passed = 0;
let failed = 0;
const failures = [];

function assert(condition, msg) {
  totalTests++;
  if (condition) {
    passed++;
    console.log(`  ✓ ${msg}`);
  } else {
    failed++;
    failures.push(msg);
    console.log(`  ✗ ${msg}`);
  }
}

function assertEq(actual, expected, msg) {
  assert(actual === expected, `${msg} (expected ${expected}, got ${actual})`);
}

function assertGt(actual, threshold, msg) {
  assert(actual > threshold, `${msg} (got ${actual}, expected > ${threshold})`);
}

function assertLt(actual, threshold, msg) {
  assert(actual < threshold, `${msg} (got ${actual}, expected < ${threshold})`);
}

function assertIncludes(arr, item, msg) {
  assert(arr.includes(item), `${msg} (array doesn't include "${item}")`);
}

// ================================================================
console.log("\n╔══════════════════════════════════════════════════════════╗");
console.log("║  POLYERP WASI 0.3 — MANUAL BLACKBOX QA                  ║");
console.log("╚══════════════════════════════════════════════════════════╝\n");

// ================================================================
console.log("━━━ SUITE 1: getTelemetry() — Observability Benchmarks ━━━");
// ================================================================

{
  const t = gatewayApi.getTelemetry();
  
  assert(Array.isArray(t), "getTelemetry returns an array");
  assertEq(t.length, 4, "getTelemetry returns exactly 4 entries");
  
  const names = t.map(x => x.architecture);
  assertIncludes(names, "Wasm Component", "Contains Wasm Component");
  assertIncludes(names, "REST (Network IPC)", "Contains REST");
  assertIncludes(names, "FFI (Unsafe C-Boundary)", "Contains FFI");
  assertIncludes(names, "JSON-RPC (stdio Pipe)", "Contains JSON-RPC");
  
  // Each entry must have the right fields
  for (const entry of t) {
    assert(typeof entry.architecture === 'string', `  ${entry.architecture}: architecture is string`);
    assert(typeof entry.throughputMsgSec === 'number', `  ${entry.architecture}: throughputMsgSec is number`);
    assert(typeof entry.latencyNs === 'bigint', `  ${entry.architecture}: latencyNs is bigint`);
    assert(typeof entry.timestamp === 'bigint', `  ${entry.architecture}: timestamp is bigint`);
  }
  
  // Wasm should be fastest
  const wasm = t.find(x => x.architecture === "Wasm Component");
  const rest = t.find(x => x.architecture === "REST (Network IPC)");
  const ffi = t.find(x => x.architecture === "FFI (Unsafe C-Boundary)");
  const rpc = t.find(x => x.architecture === "JSON-RPC (stdio Pipe)");
  
  assertLt(Number(wasm.latencyNs), Number(rest.latencyNs), "Wasm latency < REST latency");
  assertLt(Number(wasm.latencyNs), Number(ffi.latencyNs), "Wasm latency < FFI latency");
  assertLt(Number(wasm.latencyNs), Number(rpc.latencyNs), "Wasm latency < JSON-RPC latency");
  
  // Wasm should have highest throughput
  assertGt(wasm.throughputMsgSec, rest.throughputMsgSec, "Wasm throughput > REST throughput");
  assertGt(wasm.throughputMsgSec, ffi.throughputMsgSec, "Wasm throughput > FFI throughput");
  assertGt(wasm.throughputMsgSec, rpc.throughputMsgSec, "Wasm throughput > JSON-RPC throughput");
  
  // Timestamps should be recent (within 5 seconds)
  const now = Date.now();
  for (const entry of t) {
    const diff = Math.abs(Number(entry.timestamp) - now);
    assertLt(diff, 5000, `  ${entry.architecture} timestamp within 5s of now`);
  }
  
  // Telemetry should vary between calls (randomness)
  const t2 = gatewayApi.getTelemetry();
  const wasm2 = t2.find(x => x.architecture === "Wasm Component");
  assert(wasm.latencyNs !== wasm2.latencyNs || wasm.throughputMsgSec !== wasm2.throughputMsgSec,
    "Telemetry varies between calls (randomness injected)");
}

// ================================================================
console.log("\n━━━ SUITE 2: processPipeline() — Order Processing ━━━");
// ================================================================

{
  // 2a. Basic valid orders
  console.log("\n  --- 2a. Basic valid orders ---");
  const orders = [
    { id: "ORD-001", itemId: "ITEM-99", quantity: 10, userId: "user_alice" },
    { id: "ORD-002", itemId: "ITEM-42", quantity: 5, userId: "user_bob" },
  ];
  const updates = gatewayApi.processPipeline(orders);
  
  assert(Array.isArray(updates), "processPipeline returns an array");
  assertEq(updates.length, 2, "Both valid orders produce updates");
  
  // Verify stock was deducted
  const stockAfter = gatewayApi.getStock(["ITEM-99", "ITEM-42"]);
  assertLt(Number(stockAfter[0]), 1000000, "ITEM-99 stock decreased after order");
  assertLt(Number(stockAfter[1]), 500000, "ITEM-42 stock decreased after order");
  
  // 2b. Fraud filtering
  console.log("\n  --- 2b. Fraud filtering ---");
  const mixedOrders = [
    { id: "FRD-001", itemId: "ITEM-99", quantity: 200, userId: "guest_hacker" },
    { id: "OK-001", itemId: "ITEM-99", quantity: 2, userId: "user_good" },
  ];
  const fraudUpdates = gatewayApi.processPipeline(mixedOrders);
  assertEq(fraudUpdates.length, 1, "Only non-fraud order produces update (guest_200 filtered)");
  assertEq(fraudUpdates[0].itemId, "ITEM-99", "Update is for the valid order's item");
  
  // 2c. Extreme quantity fraud
  console.log("\n  --- 2c. Extreme quantity fraud ---");
  const extremeOrders = [
    { id: "EXT-001", itemId: "ITEM-07", quantity: 600, userId: "user_admin" },
    { id: "EXT-002", itemId: "ITEM-07", quantity: 1, userId: "user_admin" },
  ];
  const extremeUpdates = gatewayApi.processPipeline(extremeOrders);
  assertEq(extremeUpdates.length, 1, "Qty 600 is fraud regardless of user, only qty 1 passes");
  
  // 2d. Suspicious item ID fraud
  console.log("\n  --- 2d. Suspicious item ID ---");
  const suspOrders = [
    { id: "SUS-001", itemId: "SUSP-STOLEN", quantity: 1, userId: "user_nobody" },
  ];
  const suspUpdates = gatewayApi.processPipeline(suspOrders);
  assertEq(suspUpdates.length, 0, "SUSP- prefix items are always fraud");
}

// ================================================================
console.log("\n━━━ SUITE 3: getStock() — Inventory Query ━━━");
// ================================================================

{
  // 3a. Known items
  const stock = gatewayApi.getStock(["ITEM-99", "ITEM-42", "ITEM-07", "ITEM-21"]);
  assertEq(stock.length, 4, "Returns stock for all 4 requested items");
  
  for (let i = 0; i < 4; i++) {
    assertGt(Number(stock[i]), 0, `  Item ${i} has stock > 0`);
  }
  
  // 3b. Unknown items
  const unknownStock = gatewayApi.getStock(["NONEXISTENT-999"]);
  assertEq(unknownStock.length, 1, "Returns entry for unknown item");
  assertEq(Number(unknownStock[0]), 0, "Unknown item returns stock 0");
  
  // 3c. Empty list
  const emptyStock = gatewayApi.getStock([]);
  assertEq(emptyStock.length, 0, "Empty item list returns empty result");
  
  // 3d. Mixed known/unknown
  const mixedStock = gatewayApi.getStock(["ITEM-99", "FAKE-001"]);
  assertEq(mixedStock.length, 2, "Returns 2 entries for mixed query");
  assertGt(Number(mixedStock[0]), 0, "Known item has stock > 0");
  assertEq(Number(mixedStock[1]), 0, "Unknown item has stock 0");
}

// ================================================================
console.log("\n━━━ SUITE 4: Edge Cases & Stress Testing ━━━");
// ================================================================

{
  // 4a. Empty order list
  console.log("\n  --- 4a. Empty order list ---");
  const emptyResult = gatewayApi.processPipeline([]);
  assertEq(emptyResult.length, 0, "Empty orders returns empty updates");
  
  // 4b. Zero quantity order (valid but no stock change)
  console.log("\n  --- 4b. Zero quantity order ---");
  const zeroOrders = [
    { id: "ZERO-001", itemId: "ITEM-99", quantity: 0, userId: "user_zero" },
  ];
  const zeroUpdates = gatewayApi.processPipeline(zeroOrders);
  assertEq(zeroUpdates.length, 1, "Zero-qty order still produces update");
  
  // 4c. Large quantity that exceeds stock (but below fraud threshold)
  console.log("\n  --- 4c. Oversold (qty > stock, qty=499 which is < 500 fraud threshold) ---");
  const oversoldOrders = [
    { id: "OVER-001", itemId: "ITEM-21", quantity: 499, userId: "user_oversell" },
  ];
  const oversoldUpdates = gatewayApi.processPipeline(oversoldOrders);
  assertEq(oversoldUpdates.length, 1, "Oversold order still produces update");
  // Stock should not go below 0 (insufficient stock = no deduction per Rust logic)
  // But the update should report the unchanged stock
  
  // 4d. Stress test — burst of 100 orders
  console.log("\n  --- 4d. Stress test: 100 orders ---");
  const stockBefore = Number(gatewayApi.getStock(["ITEM-99"])[0]);
  const stressOrders = [];
  for (let i = 0; i < 100; i++) {
    stressOrders.push({
      id: `STRESS-${String(i).padStart(3, '0')}`,
      itemId: "ITEM-99",
      quantity: 1,
      userId: `user_stress_${i}`,
    });
  }
  const stressUpdates = gatewayApi.processPipeline(stressOrders);
  assertEq(stressUpdates.length, 100, "All 100 valid orders produce updates");
  const stockAfter = Number(gatewayApi.getStock(["ITEM-99"])[0]);
  assertEq(stockAfter, stockBefore - 100, `Stock deducted correctly: ${stockBefore} → ${stockAfter} (delta = ${stockBefore - stockAfter})`);
  
  // 4e. Stress test — 500 orders with mixed fraud
  console.log("\n  --- 4e. Stress test: 500 mixed orders ---");
  const stockBefore2 = Number(gatewayApi.getStock(["ITEM-42"])[0]);
  const mixedStressOrders = [];
  let expectedValid = 0;
  for (let i = 0; i < 500; i++) {
    const isFraud = i % 5 === 0; // Every 5th order is fraudulent (guest + high qty)
    if (!isFraud) expectedValid++;
    mixedStressOrders.push({
      id: `MIX-${String(i).padStart(3, '0')}`,
      itemId: "ITEM-42",
      quantity: isFraud ? 200 : 1,
      userId: isFraud ? `guest_${i}` : `user_${i}`,
    });
  }
  const mixedUpdates = gatewayApi.processPipeline(mixedStressOrders);
  assertEq(mixedUpdates.length, expectedValid, `${expectedValid} valid orders out of 500 (fraud filtered)`);
  const stockAfter2 = Number(gatewayApi.getStock(["ITEM-42"])[0]);
  assertEq(stockAfter2, stockBefore2 - expectedValid, `Stock matches: ${stockBefore2} → ${stockAfter2} (deducted ${stockBefore2 - stockAfter2})`);
  
  // 4f. Very long strings in order fields
  console.log("\n  --- 4f. Long string fields ---");
  const longOrders = [
    { 
      id: "A".repeat(1000), 
      itemId: "ITEM-99", 
      quantity: 1, 
      userId: "x".repeat(500) 
    },
  ];
  const longUpdates = gatewayApi.processPipeline(longOrders);
  assertEq(longUpdates.length, 1, "Long string fields don't break processing");
}

// ================================================================
console.log("\n━━━ SUITE 5: Telemetry Consistency ━━━");
// ================================================================

{
  // 5a. Multiple sequential calls produce consistent structure
  const results = [];
  for (let i = 0; i < 5; i++) {
    results.push(gatewayApi.getTelemetry());
  }
  
  for (let i = 0; i < 5; i++) {
    assertEq(results[i].length, 4, `  Call ${i+1}: returns 4 entries`);
  }
  
  // 5b. Ordering consistency — Wasm should always be fastest
  for (let i = 0; i < 5; i++) {
    const wasm = results[i].find(x => x.architecture === "Wasm Component");
    const rest = results[i].find(x => x.architecture === "REST (Network IPC)");
    assert(Number(wasm.latencyNs) < Number(rest.latencyNs), `  Call ${i+1}: Wasm < REST latency`);
    assert(wasm.throughputMsgSec > rest.throughputMsgSec, `  Call ${i+1}: Wasm > REST throughput`);
  }
  
  // 5c. Latency ratios make physical sense
  // REST should be ~1.5ms+ slower than Wasm baseline
  const t = gatewayApi.getTelemetry();
  const wasmLat = Number(t.find(x => x.architecture === "Wasm Component").latencyNs);
  const restLat = Number(t.find(x => x.architecture === "REST (Network IPC)").latencyNs);
  const restOverhead = restLat - wasmLat;
  assertGt(restOverhead, 1000000, `  REST overhead > 1ms (${(restOverhead/1000000).toFixed(2)}ms)`);
}

// ================================================================
// FINAL REPORT
// ================================================================
console.log("\n╔══════════════════════════════════════════════════════════╗");
console.log(`║  RESULTS: ${passed}/${totalTests} PASSED, ${failed} FAILED                    `);
console.log("╚══════════════════════════════════════════════════════════╝");

if (failures.length > 0) {
  console.log("\n❌ FAILURES:");
  failures.forEach(f => console.log(`  • ${f}`));
}

process.exit(failed > 0 ? 1 : 0);
