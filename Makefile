.PHONY: build build-rust build-python build-gateway build-frontend compose run dashboard clean optimize optimize-benchmark

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
