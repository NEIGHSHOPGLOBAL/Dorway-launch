import PDFDocument from "pdfkit";
import type { Order, Plan, User } from "@prisma/client";
import { config } from "./config.js";

const rupees = (paise: bigint | number) => `Rs. ${(Number(paise) / 100).toFixed(2)}`;

/**
 * userchanges.md X-5 — renders straight off the stored Order columns, never
 * recomputed, so the PDF always matches the quote/order/admin totals exactly.
 */
export function renderInvoicePdf(order: Order & { plan: Plan; user: User }): PDFKit.PDFDocument {
  const doc = new PDFDocument({ size: "A4", margin: 50 });

  doc.fontSize(20).text("Dorway", { continued: false });
  doc.fontSize(10).fillColor("#56675F").text("Tax invoice").fillColor("#12211C");
  doc.moveDown(1.5);

  doc.fontSize(11);
  doc.text(`Invoice for order ${order.id}`);
  doc.text(`Date: ${(order.paidAt ?? order.createdAt).toLocaleDateString("en-IN")}`);
  doc.text(`Billed to: ${order.invoiceEmail ?? order.user.email ?? "—"}`);
  if (order.user.businessName) doc.text(`Business: ${order.user.businessName}`);
  if (order.user.gstin) doc.text(`GSTIN: ${order.user.gstin}`);
  if (order.placeOfSupply) doc.text(`Place of supply: ${order.placeOfSupply}`);
  doc.text(`Supplier state code: ${config.supplierStateCode}`);
  doc.moveDown(1.5);

  doc.fontSize(12).text(`${order.plan.name} · ${order.termMonths} months`);
  doc.fontSize(11).moveDown(0.5);

  const row = (label: string, value: string) => {
    doc.text(label, { continued: true, width: 300 });
    doc.text(value, { align: "right" });
  };

  row("Rate per month", rupees(order.ratePaiseMonth));
  row(`Subtotal (${order.termMonths} months, ${order.discountPercent}% off)`, rupees(order.subtotalPaise));
  if (order.savingsPaise > 0n) row("You saved", rupees(order.savingsPaise));
  if (order.igstPaise > 0n) {
    row("IGST (18%)", rupees(order.igstPaise));
  } else {
    row("CGST (9%)", rupees(order.cgstPaise));
    row("SGST (9%)", rupees(order.sgstPaise));
  }
  doc.moveDown(0.3);
  doc.fontSize(13).font("Helvetica-Bold");
  row("Total paid", rupees(order.totalPaise));
  doc.font("Helvetica").fontSize(10).moveDown(2);
  doc.fillColor("#56675F").text("This is a system-generated invoice and does not require a signature.");

  doc.end();
  return doc;
}
