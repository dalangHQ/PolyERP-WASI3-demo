/** @module Interface demo:poly-erp/types@1.0.0 **/
export interface Order {
  id: string,
  itemId: string,
  quantity: number,
  userId: string,
}
export interface FraudResult {
  orderId: string,
  isFraud: boolean,
}
