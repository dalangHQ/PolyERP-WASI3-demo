// Ambient declarations for WIT imports — jco resolves these at componentize time
declare module 'demo:poly-erp/inventory@1.0.0' {
  export function processOrdersBatch(orders: any[]): any[];
  export function getStock(itemIds: string[]): Uint32Array;
  export function getMemoryStats(): any;
}
declare module 'demo:poly-erp/fraud-detection@1.0.0' {
  export function checkFraudBatch(orders: any[]): any[];
}
