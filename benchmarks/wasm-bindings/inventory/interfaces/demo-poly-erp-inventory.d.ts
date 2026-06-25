/** @module Interface demo:poly-erp/inventory@1.0.0 **/
export function processOrdersBatch(orders: Array<Order>): Array<InventoryUpdate>;
export function getStock(itemIds: Array<string>): Uint32Array;
export function getMemoryStats(): MemoryStats;
export type Order = import('./demo-poly-erp-types.js').Order;
export type InventoryUpdate = import('./demo-poly-erp-types.js').InventoryUpdate;
export type MemoryStats = import('./demo-poly-erp-types.js').MemoryStats;
