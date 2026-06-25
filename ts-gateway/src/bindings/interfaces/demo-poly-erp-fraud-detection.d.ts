/// <reference path="./demo-poly-erp-types.d.ts" />
declare module 'demo:poly-erp/fraud-detection@1.0.0' {
  export function checkFraudBatch(orders: Array<Order>): Array<FraudResult>;
  export type Order = import('demo:poly-erp/types@1.0.0').Order;
  export type FraudResult = import('demo:poly-erp/types@1.0.0').FraudResult;
}
