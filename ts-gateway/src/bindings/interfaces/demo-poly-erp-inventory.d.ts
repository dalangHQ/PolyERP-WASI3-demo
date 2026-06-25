/// <reference path="./demo-poly-erp-types.d.ts" />
declare module 'demo:poly-erp/inventory@1.0.0' {
  export function processOrdersBatch(orders: Array<Order>): Array<InventoryUpdate>;
  export function getStock(itemIds: Array<string>): Uint32Array;
  export type Order = import('demo:poly-erp/types@1.0.0').Order;
  export type InventoryUpdate = import('demo:poly-erp/types@1.0.0').InventoryUpdate;
}
