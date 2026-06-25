/** @module Interface demo:poly-erp/types@1.0.0 **/
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
export interface MemoryStats {
  linearMemoryBytes: bigint,
  totalOrdersTracked: number,
  dbEntries: number,
  peakBatchSize: number,
}
