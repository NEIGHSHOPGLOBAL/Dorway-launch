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

function cashfreeCustomerId(id: string): string {
  const cleaned = id.replace(/[^A-Za-z0-9]/g, "");
  return (cleaned.length >= 3 ? cleaned : `cust${cleaned}`).slice(0, 50);
}

function cashfreePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length >= 10) return digits.slice(-10);
  return "9999999999";
}

function cashfreeName(name: string): string {
  const trimmed = name.trim().slice(0, 100);
  return trimmed.length >= 3 ? trimmed : "Customer";
}

export async function cfCreateOrder(input: CreateOrderInput) {
  const orderMeta: { return_url: string; notify_url?: string } = { return_url: input.returnUrl };
  // Cashfree rejects a notify URL that is not https, which is normal before deploy.
  if (input.notifyUrl.startsWith("https://")) orderMeta.notify_url = input.notifyUrl;

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
        customer_id: cashfreeCustomerId(input.customer.id),
        customer_email: input.customer.email,
        customer_phone: cashfreePhone(input.customer.phone),
        customer_name: cashfreeName(input.customer.name),
      },
      order_meta: orderMeta,
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

// userchanges.md AD-2 "Reject" — initiates a full refund via Cashfree's
// refunds endpoint. The REFUND_STATUS_WEBHOOK handler (routes/checkout.ts)
// is what actually flips the order/entitlement to REFUNDED once Cashfree
// confirms — this call only starts that process.
export async function cfCreateRefund(input: { cfOrderId: string; refundId: string; amountRupees: number; note: string }) {
  const res = await fetch(`${config.cashfree.baseUrl}/orders/${input.cfOrderId}/refunds`, {
    method: "POST",
    headers: {
      "x-client-id": config.cashfree.appId,
      "x-client-secret": config.cashfree.secretKey,
      "x-api-version": config.cashfree.apiVersion,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      refund_amount: Number(input.amountRupees.toFixed(2)),
      refund_id: input.refundId,
      refund_note: input.note,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Cashfree create-refund failed: ${res.status} ${body}`);
  }
  return (await res.json()) as { refund_id: string; cf_refund_id?: string; refund_status: string };
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
