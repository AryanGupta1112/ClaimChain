import { useState, useRef, type FormEvent } from "react";
import { useParams, Link } from "react-router-dom";
import {
  ArrowLeft,
  ArrowUpRight,
  Download,
  Upload,
  FileText,
  FileImage,
  Plus,
  Check,
  Clock3,
  CircleDollarSign,
  CalendarDays,
  Sparkles,
  ShieldCheck,
  Pencil,
  ExternalLink,
  LoaderCircle,
  CloudUpload,
  ScanText,
  Paperclip,
} from "lucide-react";
import { toast } from "sonner";
import {
  api,
  useWorkspace,
  money,
  balance,
  date,
  today,
  Badge,
  Field,
  Modal,
  Submit,
  PageHead,
  Empty,
} from "./lib";
import { TaskForm } from "./App";
import type { Draft, Evidence, RecoveryCase } from "../shared/types";
import { useAuth } from "./auth";

export function CasePage() {
  const { id } = useParams(),
    { data, run } = useWorkspace();
  const { can } = useAuth();
  const c = data.cases.find((c) => c.id === id);
  const [tab, setTab] = useState("evidence"),
    [payment, setPayment] = useState(false),
    [task, setTask] = useState(false),
    [draft, setDraft] = useState<Draft | null>(null),
    [preview, setPreview] = useState<Evidence | null>(null),
    [notes, setNotes] = useState(false),
    [busy, setBusy] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const [pendingChecks, setPendingChecks] = useState<Record<string, boolean>>(
    {},
  );
  if (!c)
    return (
      <Empty
        title="Case not found"
        action={
          <Link to="/cases" className="btn">
            Back to cases
          </Link>
        }
      />
    );
  const evidence = data.evidence.filter((e) => e.caseId === id),
    documents = data.documents.filter((d) => d.caseId === id),
    payments = data.payments.filter((p) => p.caseId === id),
    tasks = data.tasks.filter((t) => t.caseId === id),
    checklist = data.checklist.filter((i) => i.caseId === id),
    events = data.events.filter((e) => e.entityId === id);
  const unpaid = balance(data, c),
    received = c.amount - unpaid;
  async function generate(ai = false) {
    setBusy(ai ? "ai" : "draft");
    const result = await run(
      () =>
        api<Draft>(`/cases/${id}/documents`, "POST", {
          kind: c!.kind === "payment" ? "reminder" : "request",
          ai,
        }),
      "Draft prepared for review",
    );
    setBusy("");
    if (result) {
      setDraft(result);
      setTab("documents");
    }
  }
  async function toggleRequirement(itemId: string, checked: boolean) {
    setPendingChecks((current) => ({ ...current, [itemId]: checked }));
    setBusy(itemId);
    await run(() => api(`/checklist/${itemId}`, "PATCH", { done: checked }));
    setPendingChecks((current) => {
      const next = { ...current };
      delete next[itemId];
      return next;
    });
    setBusy("");
  }
  return (
    <>
      <Link to="/cases" className="back-link">
        <ArrowLeft size={15} />
        Recovery cases
      </Link>
      <PageHead title={c.title} description={`${c.number} · ${c.counterparty}`}>
        <Badge status={c.status} />
        {can("export_packets") && (
          <a className="btn" href={`/api/cases/${id}/packet`} download>
            <Download size={16} />
            Export packet
          </a>
        )}
      </PageHead>
      <div className="case-layout">
        <div className="case-main">
          <section className="case-summary">
            <div className="section-title">
              <h2>Case summary</h2>
              {can("manage_cases") && (
                <button
                  className="icon-btn"
                  onClick={() => setNotes(true)}
                  title="Edit summary"
                  aria-label="Edit summary"
                >
                  <Pencil size={16} />
                </button>
              )}
            </div>
            <p>{c.summary || "No notes recorded."}</p>
            <dl className="case-facts">
              <div>
                <dt>Counterparty</dt>
                <dd>{c.counterparty}</dd>
              </div>
              <div>
                <dt>{c.kind === "payment" ? "Invoice number" : "Case type"}</dt>
                <dd>
                  {c.kind === "payment"
                    ? c.invoice || "Not provided"
                    : c.kind === "document"
                      ? "Document recovery"
                      : "Evidence assistance"}
                </dd>
              </div>
              <div>
                <dt>{c.kind === "payment" ? "Payment due" : "Target date"}</dt>
                <dd
                  className={
                    c.dueDate < today() && c.status !== "resolved"
                      ? "overdue-text"
                      : ""
                  }
                >
                  {date(c.dueDate)}
                </dd>
              </div>
              <div>
                <dt>Opened</dt>
                <dd>{date(c.createdAt)}</dd>
              </div>
            </dl>
          </section>
          <div
            className="view-tabs detail-tabs"
            role="group"
            aria-label="Case view"
          >
            {[
              ["evidence", "Evidence", evidence.length],
              ["documents", "Documents", documents.length],
              ["timeline", "Timeline", events.length],
              ...(c.kind === "payment"
                ? [["payments", "Payments", payments.length]]
                : []),
            ].map(([key, label, count]) => (
              <button
                key={key}
                className={tab === key ? "active" : ""}
                onClick={() => setTab(String(key))}
              >
                {label}
                <span>{count}</span>
              </button>
            ))}
          </div>
          {tab === "evidence" && (
            <section>
              {can("manage_evidence") && (
                <input
                  ref={input}
                  type="file"
                  className="sr-only"
                  aria-label="Upload evidence file"
                  accept=".pdf,.png,.jpg,.jpeg,.txt"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    if (file.size > 10 * 1024 * 1024) {
                      toast.error("Files must be 10 MB or smaller");
                      return;
                    }
                    const form = new FormData();
                    form.append("file", file);
                    setBusy("upload");
                    await run(
                      () => api(`/cases/${id}/evidence`, "POST", form),
                      "Evidence saved",
                    );
                    setBusy("");
                    if (input.current) input.current.value = "";
                  }}
                />
              )}
              {can("manage_evidence") && (
                <button
                  className="upload-zone"
                  disabled={!!busy}
                  onClick={() => input.current?.click()}
                >
                  <span className="upload-icon">
                    {busy === "upload" ? (
                      <LoaderCircle size={23} className="spin" />
                    ) : (
                      <Upload size={23} strokeWidth={1.6} />
                    )}
                  </span>
                  <strong>
                    {busy === "upload"
                      ? "Saving evidence..."
                      : "Attach supporting evidence"}
                  </strong>
                  <small>Invoice, delivery receipt or correspondence</small>
                  <span className="file-formats">
                    PDF, PNG, JPEG, TXT
                    <span />
                    Up to 10 MB
                  </span>
                </button>
              )}
              <div className="evidence-list">
                {evidence.map((e) => (
                  <div className="evidence-row" key={e.id}>
                    <span className="document-icon">
                      {e.mime.startsWith("image/") ? (
                        <FileImage size={23} />
                      ) : (
                        <FileText size={23} />
                      )}
                    </span>
                    <button className="file-name" onClick={() => setPreview(e)}>
                      <strong>{e.name}</strong>
                      <small>
                        {(e.size / 1024).toFixed(1)} KB · {date(e.createdAt)} ·{" "}
                        {e.provider}
                      </small>
                    </button>
                    <a
                      className="icon-btn"
                      href={`/api/evidence/${e.id}/file`}
                      download
                      title={`Download ${e.name}`}
                      aria-label={`Download ${e.name}`}
                    >
                      <Download size={17} />
                    </a>
                  </div>
                ))}
              </div>
              <p className="evidence-footnote">
                <ShieldCheck size={14} />
                Original files are preserved with a SHA-256 fingerprint.
              </p>
            </section>
          )}
          {tab === "documents" && (
            <section>
              {documents.length ? (
                <div className="document-list">
                  {documents.map((d) => (
                    <div className="draft-row" key={d.id}>
                      <span className="document-icon">
                        <FileText size={24} />
                      </span>
                      <div>
                        <button
                          className="link-button"
                          onClick={() => setDraft(d)}
                        >
                          {d.title}
                        </button>
                        <small>
                          Revision {d.revision} · {d.provider} · Not sent
                        </small>
                      </div>
                      {can("prepare_documents") && (
                        <button
                          className="icon-btn"
                          title="Review draft"
                          aria-label={`Review ${d.title}`}
                          onClick={() => setDraft(d)}
                        >
                          <Pencil size={16} />
                        </button>
                      )}
                      <a
                        className="icon-btn"
                        href={`/api/documents/${d.id}/download`}
                        title="Download letter"
                        aria-label={`Download ${d.title}`}
                        download
                      >
                        <Download size={17} />
                      </a>
                    </div>
                  ))}
                </div>
              ) : (
                <Empty
                  title="No correspondence prepared"
                  detail="Prepare a draft from the facts recorded in this case."
                  action={
                    can("prepare_documents") ? (
                      <button
                        className="btn"
                        onClick={() => void generate()}
                        disabled={!!busy}
                      >
                        <FileText size={16} />
                        Prepare draft
                      </button>
                    ) : undefined
                  }
                />
              )}
            </section>
          )}
          {tab === "timeline" && (
            <div className="timeline">
              {events.map((e) => (
                <div className="timeline-item" key={e.id}>
                  <span className="timeline-dot" />
                  <div>
                    <strong>{e.action}</strong>
                    <p>{e.detail}</p>
                    <time>
                      {new Date(e.createdAt).toLocaleString("en-IN", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </time>
                  </div>
                </div>
              ))}
            </div>
          )}
          {tab === "payments" && (
            <section>
              {payments.length ? (
                <>
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Reference</th>
                          <th>Received</th>
                        </tr>
                      </thead>
                      <tbody>
                        {payments.map((p) => (
                          <tr key={p.id}>
                            <td>{date(p.date)}</td>
                            <td>{p.reference}</td>
                            <td className="money-cell green-text">
                              {money(p.amount)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="small-note">
                    Payments are owner-recorded receipts, not bank-verified
                    transactions.
                  </p>
                </>
              ) : (
                <Empty title="No receipts recorded yet" />
              )}
            </section>
          )}
        </div>
        <aside className="case-rail">
          {c.kind === "payment" ? (
            <section
              className={`balance-panel ${c.status === "resolved" ? "settled" : ""}`}
            >
              <span className="balance-label">
                {c.status === "resolved"
                  ? "Paid in full"
                  : "Outstanding balance"}
                <CircleDollarSign size={19} />
              </span>
              <strong className="balance-amount">{money(unpaid)}</strong>
              <div className="payment-meter">
                <span
                  style={{
                    transform: `scaleX(${c.amount ? received / c.amount : 0})`,
                  }}
                />
              </div>
              <div className="balance-line">
                <span>Invoice total</span>
                <strong>{money(c.amount)}</strong>
              </div>
              <div className="balance-line">
                <span>Payments recorded</span>
                <strong className="green-text">{money(received)}</strong>
              </div>
              {can("record_payments") && (
                <button
                  className="btn primary full-width"
                  onClick={() => setPayment(true)}
                  disabled={unpaid <= 0}
                >
                  <Plus size={17} />
                  {unpaid <= 0 ? "Payment complete" : "Record payment"}
                </button>
              )}
            </section>
          ) : (
            <section className="requirements">
              <h2>Recovery requirements</h2>
              <p className="muted">
                {checklist.filter((i) => i.done).length} of {checklist.length}{" "}
                complete
              </p>
              {checklist.map((item) => (
                <label key={item.id} className="requirement">
                  <input
                    type="checkbox"
                    checked={pendingChecks[item.id] ?? item.done}
                    disabled={
                      !can("manage_cases") ||
                      busy === item.id ||
                      c.status === "resolved"
                    }
                    onChange={(e) =>
                      void toggleRequirement(item.id, e.target.checked)
                    }
                  />
                  <span>{item.label}</span>
                </label>
              ))}
              {can("manage_cases") && (
                <button
                  className="btn primary full-width"
                  disabled={
                    !!busy ||
                    (c.status !== "resolved" && checklist.some((i) => !i.done))
                  }
                  onClick={async () => {
                    setBusy("resolve");
                    await run(
                      () =>
                        api(`/cases/${id}`, "PATCH", {
                          status:
                            c.status === "resolved"
                              ? "in_progress"
                              : "resolved",
                        }),
                      c.status === "resolved"
                        ? "Case reopened"
                        : "Case resolved",
                    );
                    setBusy("");
                  }}
                >
                  <Check size={16} />
                  {c.status === "resolved" ? "Reopen case" : "Resolve case"}
                </button>
              )}
            </section>
          )}
          {(can("prepare_documents") || can("manage_tasks")) && (
            <section className="case-actions">
              <h2>Next action</h2>
              {can("prepare_documents") && (
                <button
                  className="action-button"
                  disabled={!!busy}
                  onClick={() => void generate()}
                >
                  <span className="action-icon">
                    <FileText size={18} />
                  </span>
                  <span>
                    <strong>
                      Prepare{" "}
                      {c.kind === "payment" ? "a reminder" : "a request"}
                    </strong>
                    <small>Editable correspondence draft</small>
                  </span>
                  <ArrowUpRight size={16} />
                </button>
              )}
              {can("prepare_documents") && data.capabilities.bedrock && (
                <button
                  className="action-button"
                  disabled={!!busy}
                  onClick={() => void generate(true)}
                >
                  <span className="action-icon">
                    <Sparkles size={18} />
                  </span>
                  <span>
                    <strong>Draft with Bedrock</strong>
                    <small>Review before using</small>
                  </span>
                  <ArrowUpRight size={16} />
                </button>
              )}
              {can("manage_tasks") && (
                <button className="action-button" onClick={() => setTask(true)}>
                  <span className="action-icon">
                    <CalendarDays size={18} />
                  </span>
                  <span>
                    <strong>Schedule a follow-up</strong>
                    <small>Keep this case moving</small>
                  </span>
                  <Plus size={16} />
                </button>
              )}
            </section>
          )}
          <section className="case-followups">
            <div className="section-title">
              <h2>Follow-ups</h2>
              <span className="count-chip">
                {tasks.filter((t) => !t.completedAt).length}
              </span>
            </div>
            {tasks.length ? (
              tasks.map((t) => (
                <div className="mini-task" key={t.id}>
                  <button
                    className={`check-control ${t.completedAt ? "checked" : ""}`}
                    disabled={!can("manage_tasks") || busy === t.id}
                    aria-label={`${t.completedAt ? "Reopen" : "Complete"} ${t.title}`}
                    onClick={async () => {
                      setBusy(t.id);
                      await run(() =>
                        api(`/tasks/${t.id}`, "PATCH", {
                          done: !t.completedAt,
                        }),
                      );
                      setBusy("");
                    }}
                  >
                    {t.completedAt && <Check size={13} />}
                  </button>
                  <div>
                    <strong className={t.completedAt ? "struck" : ""}>
                      {t.title}
                    </strong>
                    <small
                      className={
                        !t.completedAt && t.dueDate < today()
                          ? "overdue-text"
                          : ""
                      }
                    >
                      {t.completedAt ? "Completed" : `Due ${date(t.dueDate)}`}
                    </small>
                  </div>
                </div>
              ))
            ) : (
              <p className="muted">No follow-ups scheduled.</p>
            )}
          </section>
        </aside>
      </div>
      {payment && can("record_payments") && (
        <PaymentForm c={c} remaining={unpaid} close={() => setPayment(false)} />
      )}
      {task && can("manage_tasks") && (
        <TaskForm caseId={id} close={() => setTask(false)} />
      )}
      {draft && <DraftEditor draft={draft} close={() => setDraft(null)} />}
      {notes && can("manage_cases") && (
        <NotesEditor c={c} close={() => setNotes(false)} />
      )}
      {preview && (
        <Modal title={preview.name} close={() => setPreview(null)} wide>
          <div className="modal-body">
            <div className="evidence-meta">
              <span>{preview.provider}</span>
              <span>{(preview.size / 1024).toFixed(1)} KB</span>
            </div>
            {preview.mime.startsWith("image/") ? (
              <img
                className="evidence-image"
                src={`/api/evidence/${preview.id}/file`}
                alt={`Evidence: ${preview.name}`}
              />
            ) : preview.text ? (
              <pre className="evidence-text">{preview.text}</pre>
            ) : (
              <div className="document-preview">
                <FileText size={48} strokeWidth={1} />
                <h3>{preview.name}</h3>
                <a
                  className="btn"
                  href={`/api/evidence/${preview.id}/file`}
                  download
                >
                  <Download size={16} />
                  Download original
                </a>
              </div>
            )}
            <p className="hash-label">
              SHA-256<span>{preview.digest}</span>
            </p>
            {preview.text && preview.mime.startsWith("image/") && (
              <pre className="evidence-text">{preview.text}</pre>
            )}
          </div>
          <div className="modal-actions">
            {can("manage_evidence") && data.capabilities.s3 && (
              <button
                className="btn"
                disabled={!!busy || !!preview.cloudKey}
                onClick={async () => {
                  setBusy("mirror");
                  const result = await run(
                    () =>
                      api<Evidence>(`/evidence/${preview.id}/mirror`, "POST"),
                    "Evidence mirrored to S3",
                  );
                  if (result) setPreview(result);
                  setBusy("");
                }}
              >
                <CloudUpload size={16} />
                {preview.cloudKey ? "Mirrored to S3" : "Mirror to S3"}
              </button>
            )}
            {can("manage_evidence") &&
              data.capabilities.textract &&
              preview.mime.startsWith("image/") && (
                <button
                  className="btn"
                  disabled={!!busy}
                  onClick={async () => {
                    setBusy("extract");
                    const result = await run(
                      () =>
                        api<Evidence>(
                          `/evidence/${preview.id}/extract`,
                          "POST",
                        ),
                      "Text extracted",
                    );
                    if (result) setPreview(result);
                    setBusy("");
                  }}
                >
                  <ScanText size={16} />
                  Extract text
                </button>
              )}
            <button className="btn primary" onClick={() => setPreview(null)}>
              Done
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}

function PaymentForm({
  c,
  remaining,
  close,
}: {
  c: RecoveryCase;
  remaining: number;
  close: () => void;
}) {
  const { run } = useWorkspace(),
    [busy, setBusy] = useState(false),
    [key] = useState(() => crypto.randomUUID());
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    const result = await run(
      () =>
        api(`/cases/${c.id}/payments`, "POST", {
          amount: Math.round(Number(f.get("amount")) * 100),
          date: f.get("date"),
          reference: f.get("reference"),
          key,
        }),
      "Payment recorded and balance reconciled",
    );
    setBusy(false);
    if (result) close();
  }
  return (
    <Modal title="Record a payment" close={close}>
      <form onSubmit={submit}>
        <div className="modal-body">
          <div className="inline-summary">
            <span>Outstanding · {c.counterparty}</span>
            <strong>{money(remaining)}</strong>
          </div>
          <Field label="Amount received (INR)">
            <input
              name="amount"
              type="number"
              step="0.01"
              min="0.01"
              max={remaining / 100}
              required
              autoFocus
              defaultValue={remaining / 100}
            />
          </Field>
          <Field label="Payment date">
            <input
              name="date"
              type="date"
              max={today()}
              defaultValue={today()}
              required
            />
          </Field>
          <Field label="Transaction reference">
            <input
              name="reference"
              required
              maxLength={200}
              placeholder="UPI / NEFT / receipt reference"
            />
          </Field>
          <p className="small-note">
            Record only a payment you have received. This entry does not
            initiate or verify a bank transfer.
          </p>
        </div>
        <div className="modal-actions">
          <button className="btn" type="button" onClick={close}>
            Cancel
          </button>
          <Submit busy={busy}>
            <Check size={16} />
            Record payment
          </Submit>
        </div>
      </form>
    </Modal>
  );
}

function DraftEditor({ draft, close }: { draft: Draft; close: () => void }) {
  const { run } = useWorkspace();
  const { can } = useAuth();
  const [current, setCurrent] = useState(draft),
    [body, setBody] = useState(draft.body),
    [busy, setBusy] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const keepButton = useRef<HTMLButtonElement>(null);
  const dirty = body !== current.body;
  function requestClose() {
    if (busy) return;
    if (!dirty) return close();
    setConfirmDiscard(true);
    requestAnimationFrame(() => keepButton.current?.focus());
  }
  return (
    <Modal title="Review correspondence" close={requestClose} wide>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          const result = await run(
            () =>
              api<Draft>(`/documents/${current.id}`, "PATCH", {
                body,
                revision: current.revision,
              }),
            "Draft saved",
          );
          if (result) {
            setCurrent(result);
            setConfirmDiscard(false);
          }
          setBusy(false);
        }}
      >
        <div className="modal-body">
          <div className="draft-meta">
            <span className="badge open">
              <span />
              Draft · not sent
            </span>
            <span>
              {current.provider} · revision {current.revision}
            </span>
          </div>
          <textarea
            className="letter-editor"
            aria-label="Letter content"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            required
            maxLength={30000}
            readOnly={!can("prepare_documents")}
          />
          <p className="small-note">
            Check the facts before using this letter. No external delivery or
            legal filing occurs here.
          </p>
        </div>
        <div className="modal-actions">
          {confirmDiscard ? (
            <div className="discard-prompt" role="alert">
              <strong>This draft has unsaved changes.</strong>
              <div>
                <button
                  ref={keepButton}
                  className="btn"
                  type="button"
                  onClick={() => setConfirmDiscard(false)}
                >
                  Keep editing
                </button>
                <button className="btn danger" type="button" onClick={close}>
                  Discard changes
                </button>
              </div>
            </div>
          ) : (
            <>
              <a
                className={`btn ${dirty ? "disabled-link" : ""}`}
                aria-disabled={dirty}
                tabIndex={dirty ? -1 : 0}
                href={
                  dirty ? undefined : `/api/documents/${current.id}/download`
                }
                download
              >
                <Download size={16} />
                Download PDF
              </a>
              {can("prepare_documents") && (
                <Submit busy={busy || !dirty}>
                  <Check size={16} />
                  Save draft
                </Submit>
              )}
            </>
          )}
        </div>
      </form>
    </Modal>
  );
}

function NotesEditor({ c, close }: { c: RecoveryCase; close: () => void }) {
  const { run } = useWorkspace();
  const [busy, setBusy] = useState(false);
  return (
    <Modal title="Edit case summary" close={close}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          setBusy(true);
          const result = await run(
            () => api(`/cases/${c.id}`, "PATCH", { summary: f.get("summary") }),
            "Summary saved",
          );
          setBusy(false);
          if (result) close();
        }}
      >
        <div className="modal-body">
          <Field label="Summary">
            <textarea
              name="summary"
              defaultValue={c.summary}
              maxLength={10000}
              rows={7}
              autoFocus
            />
          </Field>
        </div>
        <div className="modal-actions">
          <button className="btn" type="button" onClick={close}>
            Cancel
          </button>
          <Submit busy={busy}>Save changes</Submit>
        </div>
      </form>
    </Modal>
  );
}
