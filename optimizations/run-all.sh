#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════
# PolyERP — Full Optimization Pipeline Runner
# ═══════════════════════════════════════════════════════════════════
#
# Executes the complete optimization plan:
#   1. Pre-compile Wasm to .cwasm (cold-start Strategy A)
#   2. Attempt Wizer pre-init (Strategy B, documents what's needed)
#   3. Run full dynamic benchmark (baseline + all optimized variants)
#   4. Generate JSON results + summary
#
# Usage:
#   ./optimizations/run-all.sh [--orders N]
# ═══════════════════════════════════════════════════════════════════

set -uo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "${ROOT_DIR}"

echo "╔══════════════════════════════════════════════════════════════════════╗"
echo "║  PolyERP — Full Optimization Pipeline                                ║"
echo "║  Implements the entire optimization plan from the project brief      ║"
echo "╚══════════════════════════════════════════════════════════════════════╝"
echo ""

# ── Step 1: Pre-compile Wasm ───────────────────────────────────
echo "▶ Step 1/4: Cold-start Strategy A — wasmtime compile cache"
bash optimizations/cold-start/compile-cache.sh 2>&1 | sed 's/^/  /' | tail -20
echo ""

# ── Step 2: Wizer pre-init attempt ─────────────────────────────
echo "▶ Step 2/4: Cold-start Strategy B — Wizer pre-init (best-effort)"
bash optimizations/cold-start/wizer-preinit.sh 2>&1 | sed 's/^/  /' | tail -25
echo ""

# ── Step 3: Install benchmark deps if needed ───────────────────
echo "▶ Step 3/4: Ensure benchmark dependencies are installed"
if [ ! -d benchmarks/node_modules ]; then
  (cd benchmarks && npm install --no-audit --no-fund --silent 2>&1) | tail -5
  echo "  ✓ Dependencies installed"
else
  echo "  ✓ Dependencies already present (benchmarks/node_modules/)"
fi
echo ""

# ── Step 4: Run full dynamic benchmark ─────────────────────────
echo "▶ Step 4/4: Dynamic benchmark (baseline + all optimized variants)"
node optimizations/optimized-benchmark.mjs "$@" 2>&1 | tail -60
echo ""

# ── Summary ────────────────────────────────────────────────────
echo "╔══════════════════════════════════════════════════════════════════════╗"
echo "║  Pipeline Complete                                                   ║"
echo "╠══════════════════════════════════════════════════════════════════════╣"
echo "  Generated artifacts:"
echo "    - benchmarks/optimized-results.json     (full per-architecture results)"
echo "    - benchmarks/optimization-summary.json  (strategy-level summary)"
echo "    - optimizations/cold-start/compile-cache-result.json"
echo "    - optimizations/cold-start/wizer-preinit-result.json"
echo "    - optimizations/cold-start/poly-erp-composed.cwasm (pre-compiled)"
echo "╚══════════════════════════════════════════════════════════════════════╝"
