# PolyERP: WASI 0.3 Async Component Demo

PolyERP is an event-driven micro-ERP system designed to demonstrate the zero-network overhead and native asynchronous capabilities (`stream<T>`, `future<T>`) of the WebAssembly Component Model (WASI 0.3). 

This project bridges TypeScript, Rust, and Python into a single, dynamically linked executable using `wac` (WebAssembly Composition), while outputting real-time telemetry comparing the Component Model against traditional IPC methods.

## The Architecture
1. **Frontend Dashboard:** A React application plotting real-time telemetry and injecting a never-ending stream of mock orders.
2. **TypeScript Gateway:** Receives orders and routes them via the Canonical ABI.
3. **Python Fraud Engine:** Awaits incoming orders and returns a `future<bool>` indicating if an order is fraudulent.
4. **Rust Inventory Engine:** Ingests a `stream<order>` of valid transactions and yields a `stream<inventory-update>`.

## Observability Benchmark
The TypeScript Gateway actively tracks latency and throughput across 4 simulated/actual paradigms:
* **Wasm Component (Native):** Direct in-memory Canonical ABI boundary crossing.
* **REST (Simulated):** Network stack serialization/deserialization latency overhead.
* **FFI (Simulated):** Traditional dynamic linking overhead (C-ABI unsafe boundary).
* **JSON-RPC stdio (Simulated):** Cross-process standard I/O pipe latency.

## Prerequisites
To build and run this project, you will need the modern WebAssembly toolchain installed:
* [Rust](https://rustup.rs/) (nightly with `wasm32-wasip3` target via `-Z build-std`)
* `cargo-component` (for building the Rust Wasm component)
* `componentize-py` (for building the Python Wasm component)
* `jco` (JavaScript Component toolchain)
* `wac` (WebAssembly Composition CLI)
* `wasmtime` (v37+ for WASI 0.3 native async support)

## Build Instructions
*(Detailed build commands are provided inside each component's respective directory).*
1. Compile Rust Inventory to `inventory.wasm`
2. Compile Python Fraud to `fraud.wasm`
3. Compile TypeScript Gateway to `gateway.wasm`
4. Run `wac plug` to compose them into `poly-erp-composed.wasm`
5. Serve via `wasmtime serve poly-erp-composed.wasm`

## Quick Start
```bash
# Build all components
make build

# Run the composed Wasm binary
make run

# Start the frontend dashboard
make dashboard
```

## Optimization Suite (`optimizations/`)

This branch (`win`) ships a complete optimization suite that implements the plan
from the project brief. It addresses all four problems (cold start, hot throughput,
marshaling cost, ecosystem maturity) with a mix of:

- **Fully implemented strategies** that produce measured results today
- **Source-ready strategies** (Rust patches) that need a `cargo-component` rebuild
- **Documented strategies** that require Component Model ecosystem advances

### Run the full optimization pipeline

```bash
./optimizations/run-all.sh --orders=2000
```

This produces dynamic JSON output:

- `benchmarks/optimized-results.json` — full per-architecture metrics (baseline + optimized)
- `benchmarks/optimization-summary.json` — strategy-level summary with verdicts

### What's optimized

| Problem | Strategy | Status | Measured Impact |
|---------|----------|--------|-----------------|
| Cold start (1.3s) | wasmtime compile cache (.cwasm) | ✓ Implemented | 1.26-1.38x speedup |
| Cold start (1.3s) | Wizer pre-init | ⚠ Source-ready | expected 100x+ (needs Rust rebuild) |
| Cold start (1.3s) | Instance pool | ✓ Demonstrated | ~0ms warm |
| Hot throughput (300K) | Native wasmtime runner | ✓ Implemented | eliminates JS marshal tax |
| Hot throughput (300K) | Flat-array stock table (SIMD-style) | ✓ Implemented | 20-32x speedup (17-20M ops/s) |
| Hot throughput (300K) | opt-level=2 + backtracking regalloc | ✓ In .cwasm | baked into pre-compiled binary |
| Marshaling (15.6ms) | Binary protocol (16 bytes/order) | ✓ Implemented | 3-5x speedup (1.5-1.9ms hot) |
| Marshaling (15.6ms) | Resource handles / FlatBuffers | ⚠ Documented | needs Component Model async |
| Ecosystem | wasm-tools compose, wasmtime-native run | ✓ Implemented | documented in Makefile |

See `optimizations/README.md` for the full breakdown and reproduction steps.
