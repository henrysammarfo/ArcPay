import type { NextFunction, Request, RequestHandler, Response } from "express";
import type { AgentEndpointConfig } from "./config.js";

export type PaymentProofType = "development-bypass" | "solana-verified";

export interface PaymentProofStatus {
  readonly liveProof: boolean;
  readonly mode: "development" | "production";
  readonly proofType: PaymentProofType;
}

export interface PaymentMiddlewareOptions {
  readonly endpoint: AgentEndpointConfig;
  readonly mode?: "development" | "production";
  readonly verifier?: PaymentVerifier;
}

export interface PaymentVerifier {
  verify(request: Request, endpoint: AgentEndpointConfig): Promise<boolean>;
}

/**
 * x402 gate. Development mode accepts `x-arcpay-dev-payment: paid` for local
 * smoke tests. Production mode requires a real verifier and never accepts the
 * development bypass header.
 */
export function createPaymentMiddleware(options: PaymentMiddlewareOptions): RequestHandler {
  if (options.mode === "production" && !options.verifier) {
    throw new Error("Production x402 mode requires a payment verifier.");
  }

  return (request: Request, response: Response, next: NextFunction): void => {
    const paymentProof = request.header("x-payment");
    const devPayment = request.header("x-arcpay-dev-payment");

    if (options.mode !== "production" && (paymentProof || devPayment === "paid")) {
      response.locals.paymentProof = {
        liveProof: false,
        mode: "development",
        proofType: "development-bypass",
      } satisfies PaymentProofStatus;
      next();
      return;
    }

    if (options.mode === "production" && options.verifier) {
      void options.verifier
        .verify(request, options.endpoint)
        .then((verified) => {
          if (verified) {
            response.locals.paymentProof = {
              liveProof: true,
              mode: "production",
              proofType: "solana-verified",
            } satisfies PaymentProofStatus;
            next();
            return;
          }

          sendPaymentRequired(response, options.endpoint);
        })
        .catch(next);
      return;
    }

    sendPaymentRequired(response, options.endpoint);
  };
}

function sendPaymentRequired(response: Response, endpoint: AgentEndpointConfig): void {
  response.status(402).json({
    error: "PAYMENT_REQUIRED",
    message: "x402 payment is required for this ArcPay agent endpoint.",
    accepts: {
      amount: endpoint.price.amount,
      currency: endpoint.price.currency,
      mint: endpoint.price.mint,
      payTo: endpoint.payTo,
      network: endpoint.network,
    },
  });
}
