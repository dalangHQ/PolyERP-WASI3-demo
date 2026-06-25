# PolyERP Python Fraud Detection Component

Builds the fraud detection Wasm component using `componentize-py`.

## Build

```bash
componentize-py \
  --wit-path ../wit \
  --world fraud-service \
  componentize app.py -o fraud.wasm
```
