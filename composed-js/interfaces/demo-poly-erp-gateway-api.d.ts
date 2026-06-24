/** @module Interface demo:poly-erp/gateway-api@1.0.0 **/
export function processPipeline(orders: Array<Order>): Array<InventoryUpdate>;
export function getTelemetry(): Array<Telemetry>;
export function getStock(itemIds: Array<string>): Uint32Array;
export type Telemetry = import('./demo-poly-erp-types.js').Telemetry;
export type Order = import('./demo-poly-erp-types.js').Order;
export type InventoryUpdate = import('./demo-poly-erp-types.js').InventoryUpdate;
export type FraudResult = import('./demo-poly-erp-types.js').FraudResult;
