import { config } from "./config.js";

interface CreateOrderInput {
  orderId: string;
  orderAmountRupees: number;
  idempotencyKey: string;
  customer: { id: string; email: string; phone: string; name: string };
  returnUrl: string;
  notifyUrl: string;
  expiresAt: string;
  note: string;
}

export async function cfCreateOrder(input: CreateOrderInput) {
  const res = await fetch(`${config.cashfree.baseUrl}/orders`, {
    method: "POST",
    headers: {
      "x-client-id": config.cashfree.appId,
      "x-client-secret": config.cashfree.secretKey,
      "x-api-version": config.cashfree.apiVersion,
      "x-idempotency-key": input.idempotencyKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      order_id: input.orderId,
      order_amount: Number(input.orderAmountRupees.toFixed(2)),
      order_currency: "INR",
      customer_details: {
        customer_id: input.customer.id,
        customer_email: input.customer.email,
        customer_phone: input.customer.phone || "9999999999",
        customer_name: input.customer.name,
      },
      order_meta: {
        return_url: input.returnUrl,
        notify_url: input.notifyUrl,
      },
      order_expiry_time: input.expiresAt,
      order_note: input.note,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Cashfree create-order failed: ${res.status} ${body}`);
  }
  return (await res.json()) as { cf_order_id: string; payment_session_id: string };
}

export async function cfGetOrder(orderId: string) {
  const res = await fetch(`${config.cashfree.baseUrl}/orders/${orderId}`, {
    headers: {
      "x-client-id": config.cashfree.appId,
      "x-client-secret": config.cashfree.secretKey,
      "x-api-version": config.cashfree.apiVersion,
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Cashfree get-order failed: ${res.status} ${body}`);
  }
  return (await res.json()) as { order_status: string };
}

export interface CfPaymentAttempt {
  cf_payment_id: string;
  payment_status: string;
  payment_amount: number;
  payment_method?: Record<string, unknown>;
}

// superadmin.md §6.4 reconciliation / payment resync — cfGetOrder only
// returns the order's overall status, not the payment attempt details a
// replayed webhook needs (cf_payment_id, amount). This is the same
// Cashfree PG endpoint the dashboard's "Payments" tab reads from.
export async function cfGetOrderPayments(orderId: string): Promise<CfPaymentAttempt[]> {
  const res = await fetch(`${config.cashfree.baseUrl}/orders/${orderId}/payments`, {
    headers: {
      "x-client-id": config.cashfree.appId,
      "x-client-secret": config.cashfree.secretKey,
      "x-api-version": config.cashfree.apiVersion,
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Cashfree get-order-payments failed: ${res.status} ${body}`);
  }
  return (await res.json()) as CfPaymentAttempt[];
}
