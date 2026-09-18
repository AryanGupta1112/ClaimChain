import { DatabaseSync } from "node:sqlite";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID, createHash } from "node:crypto";
import type { State } from "../shared/types.js";
import { calendarDay } from "../shared/calendar.js";

export const uid = () => randomUUID();
export const now = () => new Date().toISOString();
export const day = (offset = 0) =>
  calendarDay(new Date(Date.now() + offset * 86400000));
export function event(
  state: State,
  entityId: string,
  entityType: string,
  action: string,
  detail: string,
) {
  state.events.unshift({
    id: uid(),
    entityId,
    entityType,
    action,
    detail,
    createdAt: now(),
  });
}
export function emptyState(): State {
  return {
    workspace: {
      name: "My store",
      owner: "Workspace owner",
      email: "owner@example.com",
      address: "",
      sample: false,
    },
    cases: [],
    payments: [],
    evidence: [],
    documents: [],
    tasks: [],
    checklist: [],
    stores: [],
    lots: [],
    transfers: [],
    events: [],
  };
}
export function sampleState(): State {
  const s = emptyState();
  s.workspace = {
    name: "Mehta General Stores",
    owner: "Aarav Mehta",
    email: "aarav@example.com",
    address: "Indiranagar, Bengaluru",
    sample: true,
  };
  const records = [
    [
      "Kaveri Cafe",
      "Wholesale grocery supply",
      "INV-2026-041",
      4850000,
      -12,
      "payment",
    ],
    [
      "Northstar Foods",
      "September supply invoice",
      "INV-2026-038",
      3275000,
      -5,
      "payment",
    ],
    [
      "Green Basket",
      "Packaged goods delivery",
      "INV-2026-052",
      1860000,
      3,
      "payment",
    ],
    [
      "City Licensing Office",
      "Trade certificate replacement",
      "",
      0,
      7,
      "document",
    ],
    [
      "Sunrise Kitchen",
      "Monthly provisions",
      "INV-2026-029",
      2400000,
      -18,
      "payment",
    ],
    [
      "Metro Distributors",
      "Damaged shipment claim",
      "PO-2026-019",
      0,
      5,
      "dispute",
    ],
  ] as const;
  records.forEach(
    ([counterparty, title, invoice, amount, due, kind], index) => {
      const id = `case-${index + 1}`;
      s.cases.push({
        id,
        number: `CC-${1041 + index}`,
        title,
        kind,
        counterparty,
        invoice,
        amount,
        dueDate: day(due),
        status: index === 4 ? "resolved" : index === 0 ? "in_progress" : "open",
        summary:
          kind === "payment"
            ? `Goods delivered to ${counterparty}. Review the invoice and delivery acknowledgement before preparing the next reminder.`
            : kind === "document"
              ? "Original trade certificate was misplaced during the store relocation. Assemble the supporting records for a replacement request."
              : "Six cartons arrived damaged. Assemble delivery records and request a replacement from the supplier.",
        createdAt: new Date(Date.now() - (25 - index) * 86400000).toISOString(),
      });
      event(s, id, "case", "Case opened", `${counterparty}: ${title}`);
      if (kind !== "payment")
        [
          "Identity or business proof",
          "Supporting records collected",
          "Request reviewed",
          "Replacement or resolution confirmed",
        ].forEach((label) =>
          s.checklist.push({ id: uid(), caseId: id, label, done: false }),
        );
    },
  );
  s.payments.push(
    {
      id: uid(),
      caseId: "case-1",
      amount: 1500000,
      date: day(-4),
      reference: "SAMPLE-UPI-4902",
      key: uid(),
      createdAt: now(),
    },
    {
      id: uid(),
      caseId: "case-5",
      amount: 2400000,
      date: day(-2),
      reference: "SAMPLE-NEFT-8107",
      key: uid(),
      createdAt: now(),
    },
  );
  event(
    s,
    "case-1",
    "case",
    "Payment recorded",
    "INR 15,000.00 owner-recorded receipt",
  );
  s.tasks.push(
    {
      id: uid(),
      caseId: "case-1",
      title: "Prepare the second payment reminder",
      dueDate: day(),
      completedAt: null,
    },
    {
      id: uid(),
      caseId: "case-2",
      title: "Confirm delivery acknowledgement",
      dueDate: day(-1),
      completedAt: null,
    },
    {
      id: uid(),
      caseId: "case-4",
      title: "Collect business registration copy",
      dueDate: day(2),
      completedAt: null,
    },
  );
  s.stores = [
    { id: "store-1", name: "Mehta General Stores", locality: "Indiranagar" },
    { id: "store-2", name: "Green Basket", locality: "Domlur" },
    { id: "store-3", name: "Corner Collective", locality: "Koramangala" },
  ];
  s.lots = [
    {
      id: "lot-1",
      storeId: "store-1",
      sku: "RICE-5KG",
      product: "Sona masoori rice",
      category: "Staples",
      unit: "bags",
      quantity: 64,
      reserved: 0,
      expiry: day(180),
      batch: "SM-0926",
    },
    {
      id: "lot-2",
      storeId: "store-2",
      sku: "OIL-1L",
      product: "Sunflower oil",
      category: "Cooking essentials",
      unit: "bottles",
      quantity: 96,
      reserved: 0,
      expiry: day(95),
      batch: "SO-0626",
    },
    {
      id: "lot-3",
      storeId: "store-3",
      sku: "TEA-250",
      product: "Assam tea",
      category: "Beverages",
      unit: "packs",
      quantity: 42,
      reserved: 0,
      expiry: day(30),
      batch: "AT-0826",
    },
    {
      id: "lot-4",
      storeId: "store-1",
      sku: "SOAP-100",
      product: "Handmade soap",
      category: "Household",
      unit: "bars",
      quantity: 120,
      reserved: 0,
      expiry: day(365),
      batch: "HS-0926",
    },
  ];
  return s;
}

export class StoreDB {
  db: DatabaseSync;
  constructor(
    public directory: string,
    seed = true,
  ) {
    mkdirSync(directory, { recursive: true });
    mkdirSync(join(directory, "evidence"), { recursive: true });
    this.db = new DatabaseSync(join(directory, "claimchain.sqlite"));
    this.db.exec(
      "PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS workspace (id INTEGER PRIMARY KEY CHECK(id = 1), schema_version INTEGER NOT NULL DEFAULT 1, revision INTEGER NOT NULL DEFAULT 0, payload TEXT NOT NULL)",
    );
    if (!this.db.prepare("SELECT id FROM workspace WHERE id=1").get()) {
      const state = seed ? sampleState() : emptyState();
      if (seed) {
        for (const [caseId, name, contents] of [
          [
            "case-1",
            "invoice-041.txt",
            "FICTIONAL SAMPLE INVOICE\n\nMEHTA GENERAL STORES\nIndiranagar, Bengaluru\n\nInvoice: INV-2026-041\nCustomer: Kaveri Cafe\n\nWholesale grocery supply\nInvoice total: INR 48,500.00\nPayment received: INR 15,000.00\nOutstanding: INR 33,500.00\n\nThis is a synthetic demonstration record, not a real transaction.",
          ],
          [
            "case-1",
            "delivery-acknowledgement.txt",
            "FICTIONAL SAMPLE DELIVERY RECORD\n\nInvoice: INV-2026-041\nRecipient: Kaveri Cafe\nItems: Wholesale grocery supply\nDelivery: Recorded complete in this fictional example.\n\nNo signature or authenticity is asserted.",
          ],
          [
            "case-2",
            "invoice-038.txt",
            "FICTIONAL SAMPLE INVOICE\n\nMEHTA GENERAL STORES\nCustomer: Northstar Foods\nInvoice: INV-2026-038\nTotal: INR 32,750.00\n\nSynthetic demonstration data.",
          ],
        ]) {
          const id = uid(),
            bytes = Buffer.from(contents);
          writeFileSync(join(directory, "evidence", id), bytes);
          state.evidence.push({
            id,
            caseId,
            name,
            mime: "text/plain",
            size: bytes.length,
            digest: createHash("sha256").update(bytes).digest("hex"),
            text: contents,
            provider: "Local text",
            createdAt: now(),
          });
        }
      }
      this.db
        .prepare("INSERT INTO workspace(id,payload) VALUES(1,?)")
        .run(JSON.stringify(state));
    }
  }
  read(): State {
    return JSON.parse(
      (
        this.db.prepare("SELECT payload FROM workspace WHERE id=1").get() as {
          payload: string;
        }
      ).payload,
    );
  }
  mutate<T>(fn: (state: State) => T): T {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const state = this.read();
      const result = fn(state);
      this.db
        .prepare(
          "UPDATE workspace SET payload=?, revision=revision+1 WHERE id=1",
        )
        .run(JSON.stringify(state));
      this.db.exec("COMMIT");
      return result;
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }
  close() {
    this.db.close();
  }
}
