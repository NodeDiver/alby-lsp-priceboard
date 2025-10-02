declare global {
  interface Window {
    webln?: {
      enable(): Promise<void>;
      makeInvoice(request: {
        amount: number;
        memo?: string;
      }): Promise<{
        paymentRequest: string;
      }>;
      sendPayment(paymentRequest: string): Promise<{
        preimage: string;
      }>;
    };
  }
}

export {};
