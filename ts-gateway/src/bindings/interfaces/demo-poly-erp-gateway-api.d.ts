/// <reference path="./demo-poly-erp-types.d.ts" />
declare module 'demo:poly-erp/gateway-api@1.0.0' {
  /**
   * Process orders through the full pipeline: fraud check -> inventory update
   */
  export function processPipeline(orders: Array<Order>): Array<InventoryUpdate>;
  /**
   * Get current telemetry benchmarks
   */
  export function getTelemetry(): Array<Telemetry>;
  /**
   * Get current stock levels
   */
  export function getStock(itemIds: Array<string>): Uint32Array;
  export type Telemetry = import('demo:poly-erp/types@1.0.0').Telemetry;
  export type Order = import('demo:poly-erp/types@1.0.0').Order;
  export type InventoryUpdate = import('demo:poly-erp/types@1.0.0').InventoryUpdate;
  export type FraudResult = import('demo:poly-erp/types@1.0.0').FraudResult;
}
