import { DatabaseSync } from "node:sqlite";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID, createHash } from "node:crypto";
import type { State, Amendment, AmendmentKind } from "../shared/types.js";
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
/**
 * Canonical serialisation for the amendment hash chain. JSON array encoding
 * fixes field order and keeps values unambiguous at their boundaries.
 */
const canonicalAmendment = (entry: Omit<Amendment, "digest">) =>
  JSON.stringify([
    entry.previousDigest,
    entry.id,
    entry.entityType,
    entry.entityId,
    entry.field,
    entry.from,
    entry.to,
    entry.kind,
    entry.reason,
    entry.actorId ?? "",
    entry.actorLabel,
    entry.createdAt,
  ]);

/**
 * Appends a field-level change carrying both sides, chained to the entry
 * before it. Reading one entry answers "what was this before?" with no replay.
 */
export function amend(
  state: State,
  input: {
    entityType: string;
    entityId: string;
    field: string;
    from: string;
    to: string;
    kind: AmendmentKind;
    reason: string;
    actorId: string | null;
    actorLabel: string;
  },
): Amendment {
  const previousDigest = state.amendments.at(-1)?.digest || "";
  const base = { ...input, id: uid(), createdAt: now(), previousDigest };
  const entry: Amendment = {
    ...base,
    digest: createHash("sha256").update(canonicalAmendment(base)).digest("hex"),
  };
  state.amendments.push(entry);
  return entry;
}

/**
 * Recomputes the chain. Detects a silently edited or removed history entry.
 * It does not defend against someone rewriting the entire chain, which needs
 * an external anchor such as a signed timestamp.
 */
export function verifyAmendments(state: State): {
  ok: boolean;
  entries: number;
  brokenAt: number | null;
} {
  let previousDigest = "";
  for (let index = 0; index < state.amendments.length; index++) {
    const entry = state.amendments[index];
    const expected = createHash("sha256")
      .update(canonicalAmendment({ ...entry, previousDigest }))
      .digest("hex");
    if (entry.previousDigest !== previousDigest || entry.digest !== expected)
      return { ok: false, entries: state.amendments.length, brokenAt: index };
    previousDigest = entry.digest;
  }
  return { ok: true, entries: state.amendments.length, brokenAt: null };
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
    amendments: [],
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
    [
      "Lotus Hostel",
      "Canteen staples invoice",
      "INV-2026-055",
      2980000,
      9,
      "payment",
    ],
    ["Civic Market Board", "Vendor permit correction", "", 0, 12, "document"],
    [
      "Blue Door Bakery",
      "Flour and oils delivery",
      "INV-2026-057",
      1745000,
      -2,
      "payment",
    ],
    [
      "Silverline Caterers",
      "Festival supply order",
      "INV-2026-061",
      6120000,
      14,
      "payment",
    ],
    [
      "Aster Apartments",
      "Resident store credit",
      "INV-2026-044",
      936000,
      1,
      "payment",
    ],
    [
      "Harbor Mini Mart",
      "Incorrect carton count",
      "PO-2026-027",
      0,
      8,
      "dispute",
    ],
    [
      "Orchid Cafe",
      "Beverage stock invoice",
      "INV-2026-063",
      2210000,
      17,
      "payment",
    ],
    [
      "District Food Office",
      "Display certificate renewal",
      "",
      0,
      21,
      "document",
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
        sample: true,
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
    {
      id: uid(),
      caseId: "case-7",
      title: "Confirm canteen delivery",
      dueDate: day(3),
      completedAt: null,
    },
    {
      id: uid(),
      caseId: "case-8",
      title: "Upload corrected permit form",
      dueDate: day(4),
      completedAt: null,
    },
    {
      id: uid(),
      caseId: "case-9",
      title: "Reconcile short payment",
      dueDate: day(-2),
      completedAt: null,
    },
    {
      id: uid(),
      caseId: "case-10",
      title: "Prepare festival order summary",
      dueDate: day(6),
      completedAt: null,
    },
    {
      id: uid(),
      caseId: "case-11",
      title: "Call accounts desk",
      dueDate: day(1),
      completedAt: null,
    },
    {
      id: uid(),
      caseId: "case-12",
      title: "Photograph damaged cartons",
      dueDate: day(2),
      completedAt: null,
    },
    {
      id: uid(),
      caseId: "case-13",
      title: "Send invoice reminder",
      dueDate: day(7),
      completedAt: null,
    },
    {
      id: uid(),
      caseId: "case-14",
      title: "Collect renewal acknowledgement",
      dueDate: day(10),
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
    {
      id: "lot-5",
      storeId: "store-2",
      sku: "FLOUR-10",
      product: "Whole wheat flour",
      category: "Staples",
      unit: "bags",
      quantity: 38,
      reserved: 0,
      expiry: day(120),
      batch: "WF-1026",
    },
    {
      id: "lot-6",
      storeId: "store-3",
      sku: "JUICE-1L",
      product: "Mixed fruit juice",
      category: "Beverages",
      unit: "cartons",
      quantity: 24,
      reserved: 0,
      expiry: day(42),
      batch: "MJ-1126",
    },
    {
      id: "lot-7",
      storeId: "store-1",
      sku: "SALT-1KG",
      product: "Iodized salt",
      category: "Staples",
      unit: "packs",
      quantity: 85,
      reserved: 0,
      expiry: day(400),
      batch: "IS-0926",
    },
    {
      id: "lot-8",
      storeId: "store-2",
      sku: "CLEAN-500",
      product: "Surface cleaner",
      category: "Household",
      unit: "bottles",
      quantity: 31,
      reserved: 0,
      expiry: day(260),
      batch: "SC-0826",
    },
    {
      id: "lot-9",
      storeId: "store-3",
      sku: "DAL-2KG",
      product: "Toor dal",
      category: "Staples",
      unit: "bags",
      quantity: 48,
      reserved: 0,
      expiry: day(150),
      batch: "TD-1026",
    },
    {
      id: "lot-10",
      storeId: "store-1",
      sku: "COFFEE-200",
      product: "Filter coffee",
      category: "Beverages",
      unit: "packs",
      quantity: 29,
      reserved: 0,
      expiry: day(210),
      batch: "FC-0926",
    },
  ];
  // Every seeded record is marked so the owner can clear the demonstration
  // workspace in one action instead of living with fiction in their books.
  s.stores.forEach((store) => (store.sample = true));
  s.lots.forEach((lot) => (lot.sample = true));
  s.tasks.forEach((task) => (task.sample = true));
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
            sample: true,
          });
        }
      }
      this.db
        .prepare("INSERT INTO workspace(id,payload) VALUES(1,?)")
        .run(JSON.stringify(state));
    }
  }
  read(): State {
    const state = JSON.parse(
      (
        this.db.prepare("SELECT payload FROM workspace WHERE id=1").get() as {
          payload: string;
        }
      ).payload,
    ) as State;
    // Workspaces written before amendments existed carry no such array. The
    // blob store has no migration runner, so absent collections are backfilled
    // on read rather than failing at the first append.
    if (!Array.isArray(state.amendments)) state.amendments = [];
    return state;
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
