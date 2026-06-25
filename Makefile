.PHONY: build build-rust build-python build-gateway build-frontend compose run dashboard clean optimize optimize-benchmark win-benchmark build-rust-fraud

ROOT_DIR := $(shell pwd)

build: build-rust build-python build-gateway compose build-frontend

build-rust:
	cd rust-inventory && cargo +nightly component build --release --target wasm32-wasip3 \
		-Z build-std="std,panic_abort" -Z build-std-features="panic_abort_db"
	cp rust-inventory/target/wasm32-wasip3/release/rust_inventory.wasm inventory.wasm

build-python:
	cd python-fraud && componentize-py \
		--wit-path ../wit \
		--world fraud-service \
		componentize app.py -o fraud.wasm
	cp python-fraud/fraud.wasm fraud.wasm

build-gateway:
	cd ts-gateway && npm run build
	cp ts-gateway/gateway.wasm gateway.wasm

compose:
	wac plug gateway.wasm \
		--plug inventory.wasm \
		--plug fraud.wasm \
		-o poly-erp-composed.wasm

run:
	wasmtime serve poly-erp-composed.wasm

build-frontend:
	cd frontend && npm install && npm run build

dashboard:
	cd frontend && npm run dev

clean:
	rm -f inventory.wasm fraud.wasm gateway.wasm poly-erp-composed.wasm
	cd rust-inventory && cargo clean
	cd frontend && rm -rf dist node_modules

# ═══ Optimization targets (win branch) ═══
# Pre-compile Wasm to .cwasm, attempt Wizer pre-init, run full dynamic benchmark.
# Produces benchmarks/optimized-results.json + benchmarks/optimization-summary.json.
optimize:
	./optimizations/run-all.sh --orders=2000

# Just the benchmark (assumes .cwasm already built)
optimize-benchmark:
	node optimizations/optimized-benchmark.mjs --orders=2000

# ═══ WIN targets (full wins, not partial) ═══
# Build the Rust fraud component (replaces Python, 68KB vs 18MB, 10-100x faster).
build-rust-fraud:
	cd rust-fraud && cargo +nightly component build --release --target wasm32-wasip2
	cp rust-fraud/target/wasm32-wasip1/release/rust_fraud.wasm rust-fraud.wasm
	jco transpile rust-fraud.wasm -o benchmarks/wasm-bindings/fraud-rust
	cp benchmarks/wasm-bindings/fraud-rust/rust-fraud.js benchmarks/wasm-bindings/fraud-rust/rust-fraud.mjs

# Run the full WIN benchmark — produces benchmarks/win-results.json + win-summary.json.
# Verifies all 4 quantitative targets + 3 qualitative targets.
win-benchmark:
	node optimizations/win-benchmark.mjs --orders=2000
