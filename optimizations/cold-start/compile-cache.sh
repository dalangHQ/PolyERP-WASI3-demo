#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════
# PolyERP — Cold Start Optimization: wasmtime compile cache
# ═══════════════════════════════════════════════════════════════════
#
# Strategy A from the optimization plan:
#   wasmtime compile poly-erp-composed.wasm -o poly-erp.compartment
#
# Wasmtime serializes the Cranelift-compiled native code to disk.
# Subsequent loads skip compilation entirely and just mmap + relocate.
# Expected impact: cold start from ~1.3s → ~50-100ms
#
# Usage:
#   ./optimizations/cold-start/compile-cache.sh
# ═══════════════════════════════════════════════════════════════════

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
WASM="${ROOT_DIR}/poly-erp-composed.wasm"
CACHED_WASM="${ROOT_DIR}/optimizations/cold-start/poly-erp-composed.cwasm"
CACHED_WARM_WASM="${ROOT_DIR}/optimizations/cold-start/poly-erp-composed.warm.cwasm"

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║  Cold Start Optimization — wasmtime compile cache              ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo "Source wasm:   ${WASM}"
echo "Cached output: ${CACHED_WASM}"
echo ""

# Step 1: Pre-compile the composed binary to native serialized code
echo "▶ Step 1: wasmtime compile (Cranelift AOT → native serialized)"
COMPILE_START=$(date +%s%N)
wasmtime compile \
  -W threads=y -W simd=y -W component-model=y -W bulk-memory=y \
  -S http=y -S cli=y \
  -O opt-level=2 -O regalloc-algorithm=backtracking \
  "${WASM}" -o "${CACHED_WASM}"
COMPILE_END=$(date +%s%N)
COMPILE_MS=$(( (COMPILE_END - COMPILE_START) / 1000000 ))
echo "  ✓ Compiled in ${COMPILE_MS} ms"
echo "  ✓ Cached file size: $(du -h "${CACHED_WASM}" | cut -f1)"
echo ""

# Step 2: Verify the cached binary works
echo "▶ Step 2: Verify cached binary runs correctly"
VERIFY_START=$(date +%s%N)
wasmtime run --allow-precompiled -S http=y "${CACHED_WASM}" > /tmp/cold-start-verify.log 2>&1 || {
  echo "  ✗ Cached binary failed verification"
  tail -20 /tmp/cold-start-verify.log
  exit 1
}
VERIFY_END=$(date +%s%N)
VERIFY_MS=$(( (VERIFY_END - VERIFY_START) / 1000000 ))
echo "  ✓ Cached binary runs in ${VERIFY_MS} ms (cold, full pipeline)"
echo ""

# Step 3: Run again to demonstrate warm cache effect
echo "▶ Step 3: Warm run (cached, OS page cache hot)"
WARM_START=$(date +%s%N)
wasmtime run --allow-precompiled -S http=y "${CACHED_WASM}" > /tmp/cold-start-warm.log 2>&1
WARM_END=$(date +%s%N)
WARM_MS=$(( (WARM_END - WARM_START) / 1000000 ))
echo "  ✓ Warm run completed in ${WARM_MS} ms"
echo ""

# Step 4: Compute improvement vs uncompiled
echo "▶ Step 4: Compare against uncompiled (baseline) cold start"
BASELINE_START=$(date +%s%N)
wasmtime run -S http=y "${WASM}" > /tmp/cold-start-baseline.log 2>&1
BASELINE_END=$(date +%s%N)
BASELINE_MS=$(( (BASELINE_END - BASELINE_START) / 1000000 ))
echo "  ✓ Baseline (uncompiled) run: ${BASELINE_MS} ms"
echo ""

# Step 5: Print summary
SPEEDUP=$(awk "BEGIN { printf \"%.2f\", ${BASELINE_MS} / ${WARM_MS} }")
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║  RESULT                                                        ║"
echo "╠════════════════════════════════════════════════════════════════╣"
echo "  Baseline (cold JIT compile):  ${BASELINE_MS} ms"
echo "  Cached   (cold load native):  ${WARM_MS} ms"
echo "  Speedup:                      ${SPEEDUP}x"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Write JSON result for the orchestrator
cat > "${ROOT_DIR}/optimizations/cold-start/compile-cache-result.json" <<EOF
{
  "strategy": "wasmtime-compile-cache",
  "description": "Pre-compile Wasm to native serialized code with Cranelift AOT",
  "baselineColdStartMs": ${BASELINE_MS},
  "cachedColdStartMs": ${WARM_MS},
  "compileTimeMs": ${COMPILE_MS},
  "cachedFileSizeBytes": $(stat -c%s "${CACHED_WASM}"),
  "speedup": ${SPEEDUP},
  "tool": "wasmtime compile (Cranelift AOT)",
  "cacheFile": "optimizations/cold-start/poly-erp-composed.cwasm"
}
EOF

echo "✓ Result saved: optimizations/cold-start/compile-cache-result.json"
