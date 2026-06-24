declare module 'demo:poly-erp/types@1.0.0' {
  export interface Order {
    id: string,
    itemId: string,
    quantity: number,
    userId: string,
  }
  export interface InventoryUpdate {
    itemId: string,
    newStock: number,
  }
  /**
   * Telemetry payload for our frontend observability dashboard
   */
  export interface Telemetry {
    architecture: string,
    throughputMsgSec: number,
    latencyNs: bigint,
    timestamp: bigint,
  }
  export interface FraudResult {
    orderId: string,
    isFraud: boolean,
  }
}
