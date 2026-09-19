import type { StoreDB } from "./store.js";
import { day, event, now, uid } from "./store.js";
import type { SimulationStatus } from "../shared/types.js";

type SimulationControl = {
  halted: number;
  ingested: number;
  last_event: string | null;
};

export class SimulationService {
  private timer?: NodeJS.Timeout;
  readonly enabled = process.env.SIMULATION_ENABLED === "true";
  readonly intervalMs = Math.max(
    5000,
    Number(process.env.SIMULATION_INTERVAL_MS || 15000),
  );

  constructor(private store: StoreDB) {
    this.store.db.exec(`
      CREATE TABLE IF NOT EXISTS simulation_control (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        halted INTEGER NOT NULL DEFAULT 0,
        ingested INTEGER NOT NULL DEFAULT 0,
        last_event TEXT
      );
      INSERT OR IGNORE INTO simulation_control(id) VALUES(1);
    `);
  }

  private control() {
    return this.store.db
      .prepare(
        "SELECT halted, ingested, last_event FROM simulation_control WHERE id=1",
      )
      .get() as SimulationControl;
  }

  start() {
    if (!this.enabled || this.timer || this.control().halted) return;
    this.timer = setInterval(() => {
      try {
        this.ingest();
      } catch (error) {
        console.error("Simulation ingestion failed", (error as Error).message);
      }
    }, this.intervalMs);
    this.timer.unref();
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }

  setHalted(halted: boolean) {
    this.store.db
      .prepare("UPDATE simulation_control SET halted=? WHERE id=1")
      .run(halted ? 1 : 0);
    if (halted) this.stop();
    else this.start();
    return this.status();
  }

  status(): SimulationStatus {
    const control = this.control();
    return {
      enabled: this.enabled,
      intervalMs: this.intervalMs,
      running: Boolean(this.timer),
      halted: Boolean(control.halted),
      ingested: control.ingested,
      lastEvent: control.last_event,
      nextEvent: [
        "Create a fictional payment recovery case",
        "Record a synthetic partial payment",
        "Schedule a simulated follow-up",
        "Apply a simulated stock feed update",
      ][control.ingested % 4],
    };
  }

  ingest() {
    const control = this.control();
    if (control.halted) throw new Error("Simulation ingestion is halted");
    const sequence = control.ingested % 4;
    const result = this.store.mutate((state) => {
      const message = (() => {
        if (sequence === 0) {
          const id = uid();
          const number = `CC-${1041 + state.cases.length}`;
          state.cases.unshift({
            id,
            number,
            title: "Simulated wholesale invoice",
            kind: "payment",
            counterparty: `Demo Retail Partner ${control.ingested + 1}`,
            invoice: `SIM-${String(control.ingested + 1).padStart(4, "0")}`,
            amount: 1250000 + control.ingested * 10000,
            dueDate: day(5),
            summary:
              "Fictional record produced by ClaimChain live ingestion simulation.",
            status: "open",
            createdAt: now(),
          });
          event(
            state,
            id,
            "case",
            "Simulated case ingested",
            `${number} from demo feed`,
          );
          return `Created ${number}`;
        }
        if (sequence === 1) {
          const target = state.cases.find(
            (item) => item.kind === "payment" && item.status !== "resolved",
          );
          if (!target) return "No eligible payment case";
          const paid = state.payments
            .filter((payment) => payment.caseId === target.id)
            .reduce((sum, payment) => sum + payment.amount, 0);
          const amount = Math.min(250000, target.amount - paid);
          if (amount <= 0) return "No outstanding balance";
          state.payments.push({
            id: uid(),
            caseId: target.id,
            amount,
            date: day(),
            reference: `SIM-RECEIPT-${control.ingested + 1}`,
            key: uid(),
            createdAt: now(),
          });
          target.status =
            amount === target.amount - paid ? "resolved" : "in_progress";
          event(
            state,
            target.id,
            "case",
            "Simulated payment ingested",
            `INR ${(amount / 100).toLocaleString("en-IN")} from demo feed`,
          );
          return `Recorded simulated payment for ${target.number}`;
        }
        if (sequence === 2) {
          const target = state.cases.find((item) => item.status !== "resolved");
          if (!target) return "No eligible case for follow-up";
          state.tasks.push({
            id: uid(),
            caseId: target.id,
            title: "Review simulated ingestion update",
            dueDate: day(1),
            completedAt: null,
          });
          event(
            state,
            target.id,
            "case",
            "Simulated follow-up ingested",
            "Review simulated ingestion update",
          );
          return `Scheduled follow-up for ${target.number}`;
        }
        const lot = state.lots[0];
        if (!lot) return "No stock lot available";
        lot.quantity += 6;
        event(
          state,
          lot.id,
          "stock",
          "Simulated stock update ingested",
          `Added 6 ${lot.unit} of ${lot.product}`,
        );
        return `Updated ${lot.product}`;
      })();
      this.store.db
        .prepare(
          "UPDATE simulation_control SET ingested=?, last_event=? WHERE id=1",
        )
        .run(control.ingested + 1, message);
      return message;
    });
    return { message: result, status: this.status() };
  }
}
