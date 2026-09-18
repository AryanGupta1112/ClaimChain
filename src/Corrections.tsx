import { useState, type FormEvent } from "react";
import {
  Undo2,
  Archive,
  ArchiveRestore,
  ArrowRight,
  PencilLine,
  ShieldAlert,
} from "lucide-react";
import { api, useWorkspace, money, Field, Modal, Submit } from "./lib";
import { useAuth } from "./auth";
import {
  FINANCIAL_CASE_FIELDS,
  type Amendment,
  type AmendableCaseField,
  type Archivable,
  type Payment,
  type RecoveryCase,
} from "../shared/types";

const FIELD_LABELS: Record<AmendableCaseField, string> = {
  amount: "Invoice amount",
  dueDate: "Due date",
  invoice: "Invoice number",
  title: "Case title",
  counterparty: "Counterparty",
};
const isFinancial = (field: string) =>
  (FINANCIAL_CASE_FIELDS as readonly string[]).includes(field);
const labelFor = (field: string) =>
  FIELD_LABELS[field as AmendableCaseField] || field;
const displayValue = (field: string, value: string) =>
  field === "amount" ? money(Number(value)) : value || "(empty)";

/**
 * Records a field-level change with both sides and a reason, rather than
 * silently overwriting a recorded fact.
 */
export function AmendCaseForm({
  c,
  close,
}: {
  c: RecoveryCase;
  close: () => void;
}) {
  const { run } = useWorkspace();
  const { can } = useAuth();
  const allowFinancial = can("amend_financials");
  const options = (Object.keys(FIELD_LABELS) as AmendableCaseField[]).filter(
    (field) =>
      (allowFinancial || !isFinancial(field)) &&
      !(field === "amount" && c.kind !== "payment"),
  );
  const [field, setField] = useState<AmendableCaseField>(
    options[0] || "invoice",
  );
  const [busy, setBusy] = useState(false);
  const current =
    field === "amount" ? String(c.amount / 100) : String(c[field] ?? "");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const raw = String(values.get("value") ?? "").trim();
    setBusy(true);
    const result = await run(
      () =>
        api(`/cases/${c.id}/amend`, "POST", {
          changes: {
            [field]: field === "amount" ? Math.round(Number(raw) * 100) : raw,
          },
          kind: values.get("kind"),
          reason: values.get("reason"),
        }),
      "Amendment recorded",
    );
    setBusy(false);
    if (result) close();
  }

  if (!options.length)
    return (
      <Modal title="Amend this case" close={close}>
        <div className="modal-body">
          <p className="permission-note" role="note">
            <ShieldAlert size={16} />
            Amending an invoice amount, due date or reference needs the
            financial amendment permission. Ask a workspace administrator.
          </p>
        </div>
        <div className="modal-actions">
          <button className="btn primary" onClick={close}>
            Close
          </button>
        </div>
      </Modal>
    );

  return (
    <Modal title="Amend this case" close={close}>
      <form onSubmit={submit}>
        <div className="modal-body">
          <p className="small-note">
            The previous value is kept with your reason. Nothing is overwritten
            without a record.
          </p>
          <Field label="Field to amend">
            <select
              value={field}
              onChange={(event) =>
                setField(event.target.value as AmendableCaseField)
              }
            >
              {options.map((option) => (
                <option key={option} value={option}>
                  {FIELD_LABELS[option]}
                  {isFinancial(option) ? " (financial)" : ""}
                </option>
              ))}
            </select>
          </Field>
          <div className="inline-summary">
            <span>Currently recorded</span>
            <strong>
              {field === "amount" ? money(c.amount) : current || "(empty)"}
            </strong>
          </div>
          <Field
            label="Corrected value"
            hint={
              field === "amount"
                ? "Cannot go below what has already been received. Reverse a payment first."
                : undefined
            }
          >
            {field === "amount" ? (
              <input
                name="value"
                type="number"
                step="0.01"
                min="0.01"
                max="100000000"
                defaultValue={current}
                required
                autoFocus
              />
            ) : field === "dueDate" ? (
              <input
                name="value"
                type="date"
                defaultValue={current}
                required
                autoFocus
              />
            ) : (
              <input
                name="value"
                maxLength={200}
                defaultValue={current}
                required={field !== "invoice"}
                autoFocus
              />
            )}
          </Field>
          <Field label="What kind of change is this?">
            <select name="kind" defaultValue="correction">
              <option value="correction">
                Correction - the original entry was wrong
              </option>
              <option value="agreed_change">
                Agreed change - the facts themselves changed
              </option>
            </select>
          </Field>
          <Field
            label="Reason"
            hint="Appears in the case packet and the audit trail."
          >
            <textarea
              name="reason"
              required
              minLength={3}
              maxLength={500}
              rows={3}
              placeholder="e.g. Invoice reissued at the agreed lower total on 12 March"
            />
          </Field>
        </div>
        <div className="modal-actions">
          <button type="button" className="btn" onClick={close}>
            Cancel
          </button>
          <Submit busy={busy}>
            <PencilLine size={16} />
            Record amendment
          </Submit>
        </div>
      </form>
    </Modal>
  );
}

/** Adds a compensating ledger entry; the original receipt is never removed. */
export function ReversePaymentForm({
  payment,
  close,
}: {
  payment: Payment;
  close: () => void;
}) {
  const { run } = useWorkspace();
  const [busy, setBusy] = useState(false);
  return (
    <Modal title="Reverse this payment" close={close}>
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          const values = new FormData(event.currentTarget);
          setBusy(true);
          const result = await run(
            () =>
              api(`/payments/${payment.id}/reverse`, "POST", {
                reason: values.get("reason"),
              }),
            "Reversal recorded and balance recalculated",
          );
          setBusy(false);
          if (result) close();
        }}
      >
        <div className="modal-body">
          <div className="inline-summary">
            <span>{payment.reference}</span>
            <strong>{money(payment.amount)}</strong>
          </div>
          <p className="small-note">
            The original receipt stays in the ledger. A correcting entry of{" "}
            {money(-payment.amount)} is recorded beside it, the outstanding
            balance is recalculated, and a settled case reopens if the balance
            is no longer clear.
          </p>
          <Field
            label="Why is this being reversed?"
            hint="Appears in the case packet and the audit trail."
          >
            <textarea
              name="reason"
              required
              minLength={3}
              maxLength={500}
              rows={3}
              autoFocus
              placeholder="e.g. Recorded 48,500 in place of 4,850"
            />
          </Field>
        </div>
        <div className="modal-actions">
          <button type="button" className="btn" onClick={close}>
            Cancel
          </button>
          <Submit busy={busy}>
            <Undo2 size={16} />
            Record reversal
          </Submit>
        </div>
      </form>
    </Modal>
  );
}

/** Archiving hides a record from working views; it never destroys it. */
export function ArchiveForm({
  entity,
  id,
  label,
  close,
}: {
  entity: string;
  id: string;
  label: string;
  close: () => void;
}) {
  const { run } = useWorkspace();
  const [busy, setBusy] = useState(false);
  return (
    <Modal title={`Archive ${label}`} close={close}>
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          const values = new FormData(event.currentTarget);
          setBusy(true);
          const result = await run(
            () =>
              api(`/archive/${entity}/${id}`, "POST", {
                reason: values.get("reason"),
              }),
            "Archived. It stays in your records and exports.",
          );
          setBusy(false);
          if (result) close();
        }}
      >
        <div className="modal-body">
          <p className="small-note">
            Archiving removes this from working lists, totals and dashboards. It
            remains in the activity log, case packets and the workspace export,
            and you can restore it at any time.
          </p>
          <Field label="Reason" hint="Kept with the record.">
            <textarea
              name="reason"
              required
              minLength={3}
              maxLength={500}
              rows={3}
              autoFocus
              placeholder="e.g. Duplicate of CC-1043"
            />
          </Field>
        </div>
        <div className="modal-actions">
          <button type="button" className="btn" onClick={close}>
            Cancel
          </button>
          <Submit busy={busy}>
            <Archive size={16} />
            Archive record
          </Submit>
        </div>
      </form>
    </Modal>
  );
}

export function RestoreButton({
  entity,
  id,
  className = "btn small-btn",
}: {
  entity: string;
  id: string;
  className?: string;
}) {
  const { run } = useWorkspace();
  const [busy, setBusy] = useState(false);
  return (
    <button
      className={className}
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await run(() => api(`/restore/${entity}/${id}`, "POST"), "Restored");
        setBusy(false);
      }}
    >
      <ArchiveRestore size={15} />
      Restore
    </button>
  );
}

export function ArchivedBanner({
  record,
  entity,
  id,
}: {
  record: Archivable;
  entity: string;
  id: string;
}) {
  if (!record.archivedAt) return null;
  return (
    <div className="archived-banner" role="status">
      <Archive size={17} />
      <div>
        <strong>This record is archived.</strong>
        <small>
          {record.archiveReason || "No reason recorded"}
          {record.archivedBy ? ` - ${record.archivedBy}` : ""}
        </small>
      </div>
      <RestoreButton entity={entity} id={id} />
    </div>
  );
}

export function AmendmentHistory({ amendments }: { amendments: Amendment[] }) {
  if (!amendments.length)
    return (
      <p className="muted">
        No recorded fact on this case has been amended. Any future change will
        appear here with its previous value and reason.
      </p>
    );
  return (
    <div className="amendment-list">
      {amendments
        .slice()
        .reverse()
        .map((entry) => (
          <div className="amendment-row" key={entry.id}>
            <span className={`amendment-kind ${entry.kind}`}>
              {entry.kind === "correction" ? "Correction" : "Agreed change"}
            </span>
            <div>
              <strong>
                {entry.entityType === "payment"
                  ? "Payment reversed"
                  : labelFor(entry.field)}
              </strong>
              <p className="amendment-change">
                <s>{displayValue(entry.field, entry.from)}</s>
                <ArrowRight size={13} />
                <b>{displayValue(entry.field, entry.to)}</b>
              </p>
              <p>{entry.reason}</p>
              <small>
                {entry.actorLabel} -{" "}
                {new Date(entry.createdAt).toLocaleString("en-IN", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </small>
            </div>
          </div>
        ))}
    </div>
  );
}
