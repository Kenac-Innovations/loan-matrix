/** Safe stock-domain messages understood by the existing Fineract route normalizer. */
export class StockControlError extends Error {
  constructor(message: string, public status = 400, public operationId?: string) { super(message); }
  get errorData() { return { defaultUserMessage: this.message, operationId: this.operationId }; }
}
