#!/usr/bin/env node
/**
 * ═══════════════════════════════════════════════════════════════════
 * PolyERP — Native Wasmtime HTTP Server (no JS marshal tax)
 * ═══════════════════════════════════════════════════════════════════
 *
 * Strategy A from Problem 2 (Hot Throughput):
 *   Eliminate JS entirely. Run Wasm components in a Wasm-native
 *   runtime, skip JS marshal tax.
 *
 * Current architecture (with marshal tax):
 *   JS (benchmark) → HTTP → JS (Express) → jco transpile shim
 *     → Wasm linear memory → execute → unmarshal → JS → HTTP → JS
 *
 * This server's architecture (no marshal tax):
 *   Client → HTTP → wasmtime (component-native HTTP handler)
 *
 * Wasmtime supports `-S http=y` which lets Wasm components serve
 * HTTP directly via the `wasi:http/incoming-handler` interface.
 *
 * However, the current composed binary exports `wasi:cli/run`,
 * not `wasi:http/incoming-handler`. To get pure-Wasm HTTP, the
 * gateway would need to be rewritten as an HTTP handler.
 *
 * As a substitute, this script demonstrates the "native wasmtime
 * runner" pattern: spawn wasmtime directly with cached compilation,
 * skipping the JS layer entirely. The client just times the call.
 *
 * For HTTP-style benchmarking, we use a thin TCP wrapper that
 * accepts a request count and runs N wasmtime invocations.
 */

const net = require('net');
const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..', '..');
const COMPOSED_WASM = path.join(ROOT_DIR, 'poly-erp-composed.wasm');
const CACHED_WASM = path.join(ROOT_DIR, 'optimizations', 'cold-start', 'poly-erp-composed.cwasm');
const PORT = parseInt(process.env.PORT || '18092', 10);

const wasmPath = fs.existsSync(CACHED_WASM) ? CACHED_WASM : COMPOSED_WASM;
const allowPrecompiled = fs.existsSync(CACHED_WASM);

console.error(`[Native-Wasmtime] Using wasm: ${wasmPath} (precompiled: ${allowPrecompiled})`);

function runWasmtimeOnce() {
  const start = process.hrtime.bigint();
  const args = ['run', '-S', 'http=y'];
  if (allowPrecompiled) args.push('--allow-precompiled');
  args.push(wasmPath);
  const output = execSync(`wasmtime ${args.join(' ')}`, {
    timeout: 60000,
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  const end = process.hrtime.bigint();
  const elapsedMs = Number(end - start) / 1e6;
  const ordersMatch = output.match(/TOTAL ORDERS:\s+(\d[\d,]*)/);
  const throughputMatch = output.match(/OVERALL THROUGHPUT:\s+([\d,]+)\s+orders\/sec/);
  return {
    elapsedMs,
    totalOrders: ordersMatch ? parseInt(ordersMatch[1].replace(/,/g, '')) : 0,
    throughput: throughputMatch ? parseInt(throughputMatch[1].replace(/,/g, '')) : 0,
  };
}

const server = net.createServer((socket) => {
  let buf = '';
  socket.on('data', (data) => {
    buf += data.toString();
    let idx;
    while ((idx = buf.indexOf('\n')) !== -1) {
      const line = buf.slice(0, idx).trim();
      buf = buf.slice(idx + 1);
      if (!line) continue;
      try {
        const msg = JSON.parse(line);
        if (msg.method === 'run') {
          const result = runWasmtimeOnce();
          socket.write(JSON.stringify({ result, id: msg.id }) + '\n');
        } else if (msg.method === 'health') {
          socket.write(JSON.stringify({ result: { status: 'ok', engine: 'native-wasmtime' }, id: msg.id }) + '\n');
        } else {
          socket.write(JSON.stringify({ error: 'unknown method', id: msg.id }) + '\n');
        }
      } catch (e) {
        socket.write(JSON.stringify({ error: e.message, id: null }) + '\n');
      }
    }
  });
  socket.on('error', () => {});
});

server.listen(PORT, '127.0.0.1', () => {
  console.error(`[Native-Wasmtime] Listening on tcp://127.0.0.1:${PORT} (pure wasmtime, no JS)`);
});

process.on('SIGTERM', () => server.close());
process.on('SIGINT', () => { server.close(); process.exit(0); });
