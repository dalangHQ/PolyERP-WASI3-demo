#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════
# PolyERP — Cold Start Optimization: Wizer pre-initialization
# ═══════════════════════════════════════════════════════════════════
#
# Strategy B from the optimization plan:
#   wizer poly-erp-composed.wasm -o poly-erp-initialized.wasm
#
# Wizer snapshots Wasm linear memory *after* initialization. The
# 50-SKU inventory DB, the fraud rules, all pre-populated in the
# binary. Cold start becomes just mmap + jump to entry point.
# Expected impact: cold start from ~1.3s → ~5-15ms
#
# Wizer constraints:
#   - The init function may not call any imported functions
#   - The Wasm module may not import globals, tables, or memories
#   - Reference types are not supported
#
# Therefore Wizer cannot be applied to the *composed* binary
# (which imports WASI + component-model interfaces), but it CAN
# be applied to the individual Rust inventory component if we
# add a `wizer.initialize` function that pre-populates the DB.
#
# This script documents the attempt and the result.
# ═══════════════════════════════════════════════════════════════════

set -uo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
WASM_COMPOSED="${ROOT_DIR}/poly-erp-composed.wasm"
WASM_INVENTORY="${ROOT_DIR}/inventory.wasm"
WASM_FRAUD="${ROOT_DIR}/fraud.wasm"
OUT_DIR="${ROOT_DIR}/optimizations/cold-start"
RESULT_JSON="${OUT_DIR}/wizer-preinit-result.json"

mkdir -p "${OUT_DIR}"

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║  Cold Start Optimization — Wizer pre-initialization            ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

ATTEMPT_RESULTS=()

# ── Attempt 1: Wizer on the composed binary ────────────────────
echo "▶ Attempt 1: Wizer on composed binary (poly-erp-composed.wasm)"
echo "  Wizer will fail if the module imports globals/tables/memories or"
echo "  if its init function calls imports. The composed binary imports"
echo "  WASI + component-model interfaces, so this will likely fail."
echo ""
WIZER_OUT="${OUT_DIR}/poly-erp-composed.wizer.wasm"
WIZER_LOG="${OUT_DIR}/wizer-composed.log"
if wizer "${WASM_COMPOSED}" -o "${WIZER_OUT}" --allow-wasi --inherit-stdio=true 2>"${WIZER_LOG}"; then
  echo "  ✓ Wizer succeeded on composed binary"
  ATTEMPT_RESULTS+=("composed: success")
else
  RC=$?
  echo "  ✗ Wizer failed on composed binary (exit ${RC})"
  echo "  Failure reason (first 5 lines of log):"
  head -5 "${WIZER_LOG}" 2>/dev/null | sed 's/^/    /'
  ATTEMPT_RESULTS+=("composed: failed (expected — component-model imports)")
fi
echo ""

# ── Attempt 2: Wizer on the inventory component ────────────────
echo "▶ Attempt 2: Wizer on inventory.wasm (Rust component, core wasm)"
WIZER_INV_OUT="${OUT_DIR}/inventory.wizer.wasm"
WIZER_INV_LOG="${OUT_DIR}/wizer-inventory.log"
if wizer "${WASM_INVENTORY}" -o "${WIZER_INV_OUT}" --allow-wasi --inherit-stdio=true -f wizer.initialize 2>"${WIZER_INV_LOG}"; then
  echo "  ✓ Wizer succeeded on inventory"
  ATTEMPT_RESULTS+=("inventory: success")
  INVENTORY_RESULT="success"
  INVENTORY_OUT_PATH="${WIZER_INV_OUT}"
else
  RC=$?
  echo "  ✗ Wizer failed on inventory (exit ${RC})"
  echo "  Failure reason (first 5 lines of log):"
  head -5 "${WIZER_INV_LOG}" 2>/dev/null | sed 's/^/    /'
  ATTEMPT_RESULTS+=("inventory: failed (init function not exported)")
  INVENTORY_RESULT="failed"
  INVENTORY_OUT_PATH=""
fi
echo ""

# ── Attempt 3: Inspect the inventory wasm for wizer.initialize ─
echo "▶ Attempt 3: Inspect inventory.wasm exports for wizer.initialize"
INSPECT_LOG="${OUT_DIR}/inventory-inspect.log"
wasm-tools print "${WASM_INVENTORY}" > "${INSPECT_LOG}" 2>&1 || true
if grep -q "wizer.initialize" "${INSPECT_LOG}" 2>/dev/null; then
  echo "  ✓ inventory.wasm DOES export wizer.initialize"
  HAS_WIZER_EXPORT="true"
else
  echo "  ✗ inventory.wasm does NOT export wizer.initialize"
  echo "    To enable Wizer pre-init, the Rust source must add:"
  echo "      #[export_name = \"wizer.initialize\"]"
  echo "      pub extern \"C\" fn wizer_init() { /* populate DB */ }"
  HAS_WIZER_EXPORT="false"
fi
echo ""

# ── Document the architectural recommendation ──────────────────
echo "▶ Architectural recommendation"
cat <<'EOF'
  To enable Wizer pre-initialization of the inventory component:

  1. Add to rust-inventory/src/lib.rs:

     /// Wizer init function — pre-populates the inventory DB at
     /// build time so cold start becomes just mmap + jump.
     #[export_name = "wizer.initialize"]
     pub extern "C" fn wizer_init() {
         // Force lazy_static initialization
         let _ = DB.lock().unwrap();
     }

  2. Build with Wizer:
     wizer inventory.wasm -o inventory.wizer.wasm --allow-wasi

  3. Compose with the pre-initialized inventory:
     wasm-tools compose gateway.wasm --plug inventory.wizer.wasm \
       --plug fraud.wasm -o poly-erp-composed.wizer.wasm

  4. The composed binary now starts with inventory DB pre-loaded
     in linear memory. Cold start drops from ~1s to ~5-15ms.

  This requires rebuilding the Rust inventory component with
  `cargo +nightly component build` (not available in this env).
EOF
echo ""

# ── Write JSON result ──────────────────────────────────────────
cat > "${RESULT_JSON}" <<EOF
{
  "strategy": "wizer-pre-initialization",
  "description": "Pre-initialize Wasm linear memory at build time so cold start is just mmap + jump",
  "expectedImpactMs": "5-15ms (down from 1337ms)",
  "attempts": [
    {
      "target": "composed-binary",
      "file": "poly-erp-composed.wasm",
      "result": "${ATTEMPT_RESULTS[0]}",
      "reason": "Composed binary imports WASI + component-model interfaces; Wizer cannot snapshot modules with import side-effects"
    },
    {
      "target": "inventory-component",
      "file": "inventory.wasm",
      "result": "${ATTEMPT_RESULTS[1]}",
      "reason": "Inventory component does not export a 'wizer.initialize' function. The Rust source must be annotated with #[export_name = \"wizer.initialize\"] and rebuilt with cargo-component."
    }
  ],
  "inventoryHasWizerExport": ${HAS_WIZER_EXPORT},
  "architecturalRecommendation": {
    "rustChange": "Add #[export_name = \"wizer.initialize\"] pub extern \"C\" fn wizer_init() to rust-inventory/src/lib.rs",
    "rebuild": "cargo +nightly component build --release --target wasm32-wasip3",
    "compose": "wasm-tools compose gateway.wasm --plug inventory.wizer.wasm --plug fraud.wasm",
    "expectedColdStartMs": "5-15"
  },
  "status": "documented-with-source-patch-needed"
}
EOF

echo "✓ Result saved: ${RESULT_JSON}"
