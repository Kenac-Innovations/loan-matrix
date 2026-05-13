export interface PaymentType {
  id: number;
  name: string;
  description?: string;
  isCashPayment: boolean;
  position: number;
  isSystemDefined: boolean;
  codeName?: string;
}

export interface PaymentTypePayload {
  name: string;
  description: string;
  isCashPayment: boolean;
  position: number;
}
