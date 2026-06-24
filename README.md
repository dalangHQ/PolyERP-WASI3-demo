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
