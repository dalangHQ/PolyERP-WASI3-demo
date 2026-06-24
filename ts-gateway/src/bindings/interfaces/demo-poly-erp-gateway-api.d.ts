/// <reference path="./demo-poly-erp-types.d.ts" />
declare module 'demo:poly-erp/gateway-api@1.0.0' {
  export function processPipeline(orders: Array<Order>): Array<InventoryUpdate>;
  export function getTelemetry(): Array<Telemetry>;
  export function getStock(itemIds: Array<string>): Uint32Array;
  export type Telemetry = import('demo:poly-erp/types@1.0.0').Telemetry;
  export type Order = import('demo:poly-erp/types@1.0.0').Order;
  export type InventoryUpdate = import('demo:poly-erp/types@1.0.0').InventoryUpdate;
  export type FraudResult = import('demo:poly-erp/types@1.0.0').FraudResult;
}
