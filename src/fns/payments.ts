import { createServerFn } from "@tanstack/react-start";
import { ObjectId } from "mongodb";
import { getDb, toObj, nextSequence, calcInstallmentStatus } from "./db";
import { getSettingsFn } from "./settings";

export const nextReceiptNumberFn = createServerFn({ method: "GET" })
  .inputValidator((d: { year: string }) => d)
  .handler(async ({ data }) => {
    const db = await getDb();
    const settings = (await getSettingsFn()) as any;
    const prefix = settings?.receipt_prefix || "RCP";
    return nextSequence(db, "receipt", prefix, data.year, 5);
  });

export const recordPaymentFn = createServerFn({ method: "POST" })
  .inputValidator(
    (d: {
      installment_id: string;
      student_id: string;
      amount: number;
      payment_mode: string;
      receipt_number: string;
      collected_by: string;
      collected_by_name: string;
      status: string;
      cheque_number?: string | null;
      cheque_bank?: string | null;
      cheque_date?: string | null;
      upi_reference?: string | null;
      card_last4?: string | null;
      notes?: string | null;
    }) => d,
  )
  .handler(async ({ data }) => {
    const db = await getDb();
    const safeOId = (id: string) => { try { return new ObjectId(id); } catch { return id as any; } };
    const now = new Date().toISOString();
    const today = now.slice(0, 10);

    const result = await db.collection("payments").insertOne({
      ...data,
      payment_date: today,
      created_at: now,
      cancelled_at: null,
      cancelled_by: null,
      cancellation_reason: null,
      cleared_at: data.status === "cleared" ? now : null,
    });

    // Update installment amount_paid and status
    const inst = await db
      .collection("installments")
      .findOne({ _id: safeOId(data.installment_id) });
    if (inst) {
      const newAmountPaid = Number(inst.amount_paid || 0) + Number(data.amount);
      const newStatus = calcInstallmentStatus(
        Number(inst.amount),
        newAmountPaid,
        inst.due_date as string,
      );
      await db.collection("installments").updateOne(
        { _id: safeOId(data.installment_id) },
        {
          $set: {
            amount_paid: newAmountPaid,
            status: newStatus,
            updated_at: now,
          },
        },
      );
    }

    return toObj(await db.collection("payments").findOne({ _id: result.insertedId }));
  });
