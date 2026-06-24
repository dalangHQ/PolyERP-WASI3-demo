/// <reference path="./demo-poly-erp-types.d.ts" />
declare module 'demo:poly-erp/inventory@1.0.0' {
  /**
   * Process a batch of orders, returns inventory updates
   */
  export function processOrders(orders: Array<Order>): Array<InventoryUpdate>;
  /**
   * Get current stock levels
   */
  export function getStock(itemIds: Array<string>): Uint32Array;
  export type Order = import('demo:poly-erp/types@1.0.0').Order;
  export type InventoryUpdate = import('demo:poly-erp/types@1.0.0').InventoryUpdate;
}
