import { useState, useEffect, useRef, type FormEvent } from "react";
import {
  NavLink,
  Link,
  Routes,
  Route,
  useLocation,
  useNavigate,
} from "react-router-dom";
import {
  LayoutDashboard,
  BriefcaseBusiness,
  Boxes,
  ListTodo,
  Activity,
  Settings,
  ArrowUpRight,
  ArrowRight,
  Plus,
  Search,
  ChevronDown,
  Menu,
  X,
  Download,
  Check,
  Clock3,
  CircleHelp,
  ShieldCheck,
  LogOut,
  Link2,
  CircleDollarSign,
  FileCheck2,
  Store,
  CalendarDays,
  SlidersHorizontal,
} from "lucide-react";
import {
  api,
  useWorkspace,
  money,
  balance,
  date,
  today,
  initials,
  Badge,
  Field,
  Modal,
  Submit,
  PageHead,
  Empty,
} from "./lib";
import type { RecoveryCase, CaseKind } from "../shared/types";
import { CasePage } from "./CasePage";
import { StockPage } from "./StockPage";
import { WORKSPACE_TIMEZONE } from "../shared/calendar";

const navigation = [
  { path: "/workspace", label: "Overview", icon: LayoutDashboard },
  { path: "/cases", label: "Recovery cases", icon: BriefcaseBusiness },
  { path: "/stock", label: "Stock exchange", icon: Boxes },
  { path: "/tasks", label: "Follow-ups", icon: ListTodo },
  { path: "/activity", label: "Activity log", icon: Activity },
];

export function App() {
  const { data } = useWorkspace();
  const [menu, setMenu] = useState(false),
    [create, setCreate] = useState(false),
    [help, setHelp] = useState(false);
  const location = useLocation();
  const title = location.pathname.startsWith("/cases/")
    ? "Case workspace"
    : [...navigation, { path: "/settings", label: "Settings" }].find(
        (n) => n.path === location.pathname,
      )?.label || "Workspace";
  const openCases = data.cases.filter((c) => c.status !== "resolved").length;
  const [mobile, setMobile] = useState(
    () => window.matchMedia("(max-width: 760px)").matches,
  );
  const sidebar = useRef<HTMLElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 760px)");
    const update = () => {
      setMobile(media.matches);
      if (!media.matches) setMenu(false);
    };
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    if (!menu || !mobile) return;
    const controls = () => [
      ...(sidebar.current?.querySelectorAll<HTMLElement>(
        "a[href],button:not(:disabled)",
      ) || []),
    ];
    controls()[0]?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const keydown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setMenu(false);
      }
      if (e.key === "Tab") {
        const items = controls(),
          first = items[0],
          last = items.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", keydown);
    return () => {
      document.removeEventListener("keydown", keydown);
      document.body.style.overflow = previousOverflow;
      menuButton.current?.focus();
    };
  }, [menu, mobile]);
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      {menu && (
        <button
          className="sidebar-backdrop"
          aria-label="Close navigation"
          onClick={() => setMenu(false)}
        />
      )}
      <aside
        ref={sidebar}
        id="workspace-navigation"
        inert={mobile && !menu}
        aria-hidden={mobile && !menu ? true : undefined}
        className={`sidebar ${menu ? "is-open" : ""}`}
      >
        <Link to="/workspace" className="brand" onClick={() => setMenu(false)}>
          <span className="brand-symbol">
            <Link2 size={23} strokeWidth={2.5} />
          </span>
          <span>
            ClaimChain<span className="brand-dot">.</span>
          </span>
        </Link>
        <Link
          to="/settings"
          className="workspace-switch"
          onClick={() => setMenu(false)}
        >
          <span className="workspace-avatar">
            <Store size={18} />
          </span>
          <span>
            <strong>{data.workspace.name}</strong>
            <small>Business workspace</small>
          </span>
          <ChevronDown size={14} />
        </Link>
        <div className="nav-label">WORKSPACE</div>
        <nav aria-label="Main navigation">
          {navigation.map(({ path, label, icon: Icon }) => (
            <NavLink
              key={path}
              to={path}
              end={path === "/"}
              onClick={() => setMenu(false)}
            >
              <Icon size={19} strokeWidth={1.7} />
              <span>{label}</span>
              {path === "/cases" && (
                <span className="nav-count">{openCases}</span>
              )}
              {path === "/tasks" &&
                data.tasks.some(
                  (t) => !t.completedAt && t.dueDate < today(),
                ) && <span className="nav-dot" />}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="workspace-state">
            <span className="live-dot" />
            <span>
              {data.workspace.sample ? "Sample workspace" : "Local workspace"}
            </span>
            <ShieldCheck size={15} />
          </div>
          <NavLink
            className="utility-link"
            to="/settings"
            onClick={() => setMenu(false)}
          >
            <Settings size={18} />
            Settings
          </NavLink>
          <button
            className="utility-link"
            onClick={() => {
              setMenu(false);
              setHelp(true);
            }}
          >
            <CircleHelp size={18} />
            About this workspace
          </button>
          <div className="profile">
            <span className="avatar owner">
              {initials(data.workspace.owner)}
            </span>
            <div>
              <strong>{data.workspace.owner}</strong>
              <small>Workspace owner</small>
            </div>
            <span className="profile-mark">AM</span>
          </div>
        </div>
      </aside>
      <div className="main-shell" inert={mobile && menu}>
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-btn mobile-menu"
              ref={menuButton}
              aria-expanded={menu}
              aria-controls="workspace-navigation"
              title="Open navigation"
              aria-label="Open navigation"
              onClick={() => setMenu(true)}
            >
              <Menu size={21} />
            </button>
            <span>Workspace</span>
            <span className="slash">/</span>
            <strong>{title}</strong>
          </div>
          <div className="topbar-right">
            <span className="local-status">
              <span className="live-dot" />
              Saved locally
            </span>
            <span className="topbar-divider" />
            <span className="avatar small">
              {initials(data.workspace.owner)}
            </span>
          </div>
        </header>
        <main id="main">
          <Routes>
            <Route
              path="/workspace"
              element={<Overview onCreate={() => setCreate(true)} />}
            />
            <Route
              path="/cases"
              element={<CasesPage onCreate={() => setCreate(true)} />}
            />
            <Route path="/cases/:id" element={<CasePage />} />
            <Route path="/stock" element={<StockPage />} />
            <Route path="/tasks" element={<TasksPage />} />
            <Route path="/activity" element={<ActivityPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route
              path="*"
              element={
                <Empty
                  title="This page isn't here"
                  action={
                    <Link className="btn primary" to="/workspace">
                      Return to workspace
                    </Link>
                  }
                />
              }
            />
          </Routes>
          <footer className="page-footer">
            <span>ClaimChain</span>
            <span>Every step, accounted for.</span>
          </footer>
        </main>
      </div>
      {create && <NewCase close={() => setCreate(false)} />}
      {help && (
        <Modal title="About your workspace" close={() => setHelp(false)}>
          <div className="modal-body prose">
            <p>
              ClaimChain keeps recovery cases, supporting evidence, payment
              receipts and store transfers together.
            </p>
            <dl>
              <dt>Workspace data</dt>
              <dd>
                {data.workspace.sample
                  ? "The starting stores and transactions are fictional sample records."
                  : "This workspace is stored locally."}{" "}
                Changes are saved to the server database.
              </dd>
              <dt>Payments and correspondence</dt>
              <dd>
                Receipts are recorded by the owner. Prepared letters are drafts;
                downloading a letter does not send it.
              </dd>
              <dt>AWS connections</dt>
              <dd>
                Optional S3, Textract and Bedrock connections are listed in
                Settings. Configuration is not proof of a successful cloud
                operation.
              </dd>
            </dl>
          </div>
          <div className="modal-actions">
            <button className="btn primary" onClick={() => setHelp(false)}>
              Done
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

export function NewCase({ close }: { close: () => void }) {
  const { run } = useWorkspace(),
    navigate = useNavigate();
  const [kind, setKind] = useState<CaseKind>("payment"),
    [busy, setBusy] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    const result = await run(
      () =>
        api<RecoveryCase>("/cases", "POST", {
          title: f.get("title"),
          kind,
          counterparty: f.get("counterparty"),
          invoice: f.get("invoice") || "",
          amount:
            kind === "payment" ? Math.round(Number(f.get("amount")) * 100) : 0,
          dueDate: f.get("dueDate"),
          summary: f.get("summary"),
        }),
      "Recovery case opened",
    );
    setBusy(false);
    if (result) {
      close();
      navigate(`/cases/${result.id}`);
    }
  }
  return (
    <Modal title="Open a recovery case" close={close}>
      <form onSubmit={submit}>
        <div className="modal-body">
          <Field label="Case type">
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as CaseKind)}
            >
              <option value="payment">Payment recovery</option>
              <option value="document">Document recovery</option>
              <option value="dispute">Evidence assistance</option>
            </select>
          </Field>
          <Field label="Case title">
            <input
              name="title"
              required
              maxLength={200}
              placeholder="e.g. September supply invoice"
              autoFocus
            />
          </Field>
          <Field
            label={
              kind === "payment"
                ? "Customer / counterparty"
                : "Organization / counterparty"
            }
          >
            <input
              name="counterparty"
              required
              maxLength={200}
              placeholder="Business or organization name"
            />
          </Field>
          <div className="form-grid">
            {kind === "payment" && (
              <Field label="Invoice amount (INR)">
                <input
                  name="amount"
                  type="number"
                  min="0.01"
                  max="100000000"
                  step="0.01"
                  required
                  placeholder="0.00"
                />
              </Field>
            )}
            <Field
              label={kind === "payment" ? "Payment due date" : "Target date"}
            >
              <input
                name="dueDate"
                type="date"
                required
                defaultValue={today()}
              />
            </Field>
          </div>
          {kind === "payment" && (
            <Field label="Invoice number">
              <input
                name="invoice"
                maxLength={200}
                placeholder="INV-2026-001"
              />
            </Field>
          )}
          <Field label="Case notes">
            <textarea
              name="summary"
              rows={3}
              maxLength={10000}
              placeholder="Record the facts and what needs to happen."
            />
          </Field>
        </div>
        <div className="modal-actions">
          <button type="button" className="btn" onClick={close}>
            Cancel
          </button>
          <Submit busy={busy}>
            <Plus size={16} />
            Create case
          </Submit>
        </div>
      </form>
    </Modal>
  );
}

export function CaseTable({
  cases,
  compact = false,
}: {
  cases: RecoveryCase[];
  compact?: boolean;
}) {
  const { data } = useWorkspace();
  if (!cases.length)
    return (
      <Empty
        title="No matching cases"
        detail="Your cases will appear here when they are opened."
      />
    );
  return (
    <div className="table-scroll">
      <table className="case-table">
        <thead>
          <tr>
            <th>Case / counterparty</th>
            <th>Outstanding</th>
            <th>Due date</th>
            <th>Status</th>
            {!compact && <th>Type</th>}
            <th>
              <span className="sr-only">Open case</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {cases.map((c, index) => (
            <tr key={c.id}>
              <td>
                <Link to={`/cases/${c.id}`} className="case-cell">
                  <span className={`avatar color-${index % 4}`}>
                    {initials(c.counterparty)}
                  </span>
                  <span>
                    <strong>{c.counterparty}</strong>
                    <small>
                      {c.number}
                      <span className="text-dot"> / </span>
                      {c.title}
                    </small>
                  </span>
                </Link>
              </td>
              <td className="money-cell">
                {c.kind === "payment" ? (
                  money(balance(data, c))
                ) : (
                  <span className="muted">No balance</span>
                )}
              </td>
              <td>
                <span
                  className={
                    c.dueDate < today() && c.status !== "resolved"
                      ? "overdue-text"
                      : ""
                  }
                >
                  {date(c.dueDate)}
                </span>
                {c.dueDate < today() && c.status !== "resolved" && (
                  <small className="due-caption">Overdue</small>
                )}
              </td>
              <td>
                <Badge status={c.status} />
              </td>
              {!compact && (
                <td>
                  <span className="muted">
                    {c.kind === "payment"
                      ? "Payment"
                      : c.kind === "document"
                        ? "Document"
                        : "Evidence"}
                  </span>
                </td>
              )}
              <td>
                <Link
                  className="icon-btn"
                  title={`Open ${c.number}`}
                  aria-label={`Open ${c.number}`}
                  to={`/cases/${c.id}`}
                >
                  <ArrowUpRight size={17} />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Overview({ onCreate }: { onCreate: () => void }) {
  const { data } = useWorkspace();
  const open = data.cases.filter((c) => c.status !== "resolved");
  const unpaid = open.reduce((sum, c) => sum + balance(data, c), 0);
  const recovered = data.payments.reduce((sum, p) => sum + p.amount, 0);
  const overdue = open.filter(
    (c) => c.kind === "payment" && c.dueDate < today(),
  );
  const tasks = data.tasks
    .filter((t) => !t.completedAt)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  return (
    <>
      <PageHead
        title="Your recovery workspace"
        description={`${new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", timeZone: WORKSPACE_TIMEZONE })} · Here's where things stand.`}
      >
        <button className="btn primary" onClick={onCreate}>
          <Plus size={17} />
          New case
        </button>
      </PageHead>
      <section className="metric-band" aria-label="Workspace totals">
        <div className="metric">
          <span>
            Outstanding balance
            <CircleDollarSign size={17} />
          </span>
          <strong>{money(unpaid)}</strong>
          <small>
            <span className="status-dot amber" />
            {overdue.length} overdue payment{" "}
            {overdue.length === 1 ? "case" : "cases"}
          </small>
        </div>
        <div className="metric">
          <span>
            Recovered to date
            <ArrowUpRight size={17} />
          </span>
          <strong className="green-text">{money(recovered)}</strong>
          <small>Across {data.payments.length} recorded payments</small>
        </div>
        <div className="metric">
          <span>
            Active cases
            <BriefcaseBusiness size={17} />
          </span>
          <strong>{String(open.length).padStart(2, "0")}</strong>
          <small>
            {data.cases.filter((c) => c.status === "resolved").length} resolved
            successfully
          </small>
        </div>
        <div className="metric">
          <span>
            Stock in motion
            <Boxes size={17} />
          </span>
          <strong>
            {String(
              data.transfers.filter((t) =>
                ["reserved", "dispatched"].includes(t.status),
              ).length,
            ).padStart(2, "0")}
          </strong>
          <small>{data.stores.length} stores in your network</small>
        </div>
      </section>
      <div className="overview-layout">
        <div className="overview-main">
          <section>
            <div className="section-title">
              <div>
                <h2>Cases that need you</h2>
                <p>Open obligations, ordered by due date.</p>
              </div>
              <Link to="/cases" className="text-link">
                All cases
                <ArrowRight size={15} />
              </Link>
            </div>
            <CaseTable
              cases={open
                .slice()
                .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
                .slice(0, 5)}
              compact
            />
          </section>
          <section className="recent-section">
            <div className="section-title">
              <div>
                <h2>Recent activity</h2>
                <p>A record of work moving forward.</p>
              </div>
              <Link to="/activity" className="text-link">
                View log
                <ArrowRight size={15} />
              </Link>
            </div>
            <div className="activity-list">
              {data.events.slice(0, 4).map((e) => (
                <div className="activity-row" key={e.id}>
                  <span
                    className={`event-icon ${e.action.includes("Payment") ? "success" : ""}`}
                  >
                    {e.action.includes("Payment") ? (
                      <CircleDollarSign size={17} />
                    ) : e.action.includes("Stock") ? (
                      <Boxes size={17} />
                    ) : (
                      <FileCheck2 size={17} />
                    )}
                  </span>
                  <div>
                    <strong>{e.action}</strong>
                    <p>{e.detail}</p>
                  </div>
                  <time>{date(e.createdAt)}</time>
                </div>
              ))}
            </div>
          </section>
        </div>
        <aside className="action-rail">
          <div className="section-title">
            <h2>
              Up next<span className="count-chip">{tasks.length}</span>
            </h2>
            <Link
              to="/tasks"
              className="icon-btn"
              aria-label="All follow-ups"
              title="All follow-ups"
            >
              <ArrowUpRight size={17} />
            </Link>
          </div>
          {tasks.length ? (
            <div className="up-next">
              {tasks.slice(0, 4).map((t) => (
                <Link
                  to={`/cases/${t.caseId}`}
                  key={t.id}
                  className="next-task"
                >
                  <span
                    className={`task-date ${t.dueDate < today() ? "late" : ""}`}
                  >
                    <Clock3 size={13} />
                    {t.dueDate === today()
                      ? "Today"
                      : t.dueDate < today()
                        ? `Overdue · ${date(t.dueDate)}`
                        : date(t.dueDate)}
                  </span>
                  <strong>{t.title}</strong>
                  <small>
                    {data.cases.find((c) => c.id === t.caseId)?.counterparty}
                    <ArrowRight size={14} />
                  </small>
                </Link>
              ))}
            </div>
          ) : (
            <Empty title="All caught up" />
          )}
          <div className="network-panel">
            <div className="network-top">
              <span className="network-icon">
                <Boxes size={24} strokeWidth={1.5} />
              </span>
              <span className="badge received">
                <span />
                {data.stores.length} stores
              </span>
            </div>
            <h3>Put surplus to work.</h3>
            <p>
              {data.lots.filter((l) => l.quantity > l.reserved).length} stock
              lots are available across your store network.
            </p>
            <Link to="/stock">
              Open stock exchange
              <ArrowUpRight size={17} />
            </Link>
          </div>
          <div className="sample-note">
            <ShieldCheck size={16} />
            <span>
              {data.workspace.sample
                ? "Fictional sample records. Your changes are saved."
                : "Your records are stored in this workspace."}
            </span>
          </div>
        </aside>
      </div>
    </>
  );
}

function CasesPage({ onCreate }: { onCreate: () => void }) {
  const { data } = useWorkspace();
  const [query, setQuery] = useState(""),
    [status, setStatus] = useState("all"),
    [kind, setKind] = useState("all"),
    [sort, setSort] = useState("due");
  const cases = data.cases
    .filter(
      (c) =>
        `${c.title} ${c.counterparty} ${c.number} ${c.invoice}`
          .toLowerCase()
          .includes(query.toLowerCase()) &&
        (status === "all" || c.status === status) &&
        (kind === "all" || c.kind === kind),
    )
    .sort((a, b) =>
      sort === "due"
        ? a.dueDate.localeCompare(b.dueDate)
        : sort === "amount"
          ? balance(data, b) - balance(data, a)
          : b.createdAt.localeCompare(a.createdAt),
    );
  return (
    <>
      <PageHead
        title="Recovery cases"
        description="Every obligation, with a clear next step."
      >
        <button className="btn primary" onClick={onCreate}>
          <Plus size={17} />
          New case
        </button>
      </PageHead>
      <div className="view-tabs" role="group" aria-label="Case status">
        {[
          ["all", "All cases"],
          ["open", "Open"],
          ["in_progress", "In progress"],
          ["resolved", "Resolved"],
        ].map(([value, label]) => (
          <button
            key={value}
            className={status === value ? "active" : ""}
            onClick={() => setStatus(value)}
          >
            {label}
            <span>
              {
                data.cases.filter((c) => value === "all" || c.status === value)
                  .length
              }
            </span>
          </button>
        ))}
      </div>
      <div className="filterbar">
        <label className="search-field">
          <Search size={17} />
          <input
            aria-label="Search cases"
            placeholder="Search cases, customers, invoices..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button
              title="Clear search"
              aria-label="Clear search"
              onClick={() => setQuery("")}
            >
              <X size={15} />
            </button>
          )}
        </label>
        <div className="filter-controls">
          <SlidersHorizontal size={16} />
          <select
            aria-label="Case type filter"
            value={kind}
            onChange={(e) => setKind(e.target.value)}
          >
            <option value="all">All types</option>
            <option value="payment">Payment</option>
            <option value="document">Document</option>
            <option value="dispute">Evidence</option>
          </select>
          <select
            aria-label="Sort cases"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          >
            <option value="due">Due date</option>
            <option value="amount">Highest balance</option>
            <option value="new">Newest first</option>
          </select>
        </div>
      </div>
      <CaseTable cases={cases} />
      <div className="table-foot">
        {cases.length} of {data.cases.length} cases
      </div>
    </>
  );
}

export function TaskForm({
  close,
  caseId,
}: {
  close: () => void;
  caseId?: string;
}) {
  const { data, run } = useWorkspace();
  const [busy, setBusy] = useState(false);
  return (
    <Modal title="Schedule a follow-up" close={close}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          const f = new FormData(e.currentTarget);
          const result = await run(
            () =>
              api("/tasks", "POST", {
                title: f.get("title"),
                caseId: caseId || f.get("caseId"),
                dueDate: f.get("dueDate"),
              }),
            "Follow-up scheduled",
          );
          setBusy(false);
          if (result) close();
        }}
      >
        <div className="modal-body">
          {!caseId && (
            <Field label="Case">
              <select name="caseId" required>
                {data.cases.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.number} - {c.counterparty}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <Field label="Follow-up">
            <input
              name="title"
              required
              maxLength={200}
              autoFocus
              placeholder="What needs to happen?"
            />
          </Field>
          <Field label="Due date">
            <input name="dueDate" type="date" required defaultValue={today()} />
          </Field>
        </div>
        <div className="modal-actions">
          <button type="button" className="btn" onClick={close}>
            Cancel
          </button>
          <Submit busy={busy}>
            <CalendarDays size={16} />
            Schedule
          </Submit>
        </div>
      </form>
    </Modal>
  );
}

function TasksPage() {
  const { data, run } = useWorkspace();
  const [filter, setFilter] = useState("open"),
    [create, setCreate] = useState(false),
    [busy, setBusy] = useState<string | null>(null);
  const tasks = data.tasks
    .filter(
      (t) =>
        filter === "all" ||
        (filter === "done" ? !!t.completedAt : !t.completedAt),
    )
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  return (
    <>
      <PageHead
        title="Follow-ups"
        description="Keep the next commitment within reach."
      >
        <button
          className="btn primary"
          onClick={() => setCreate(true)}
          disabled={!data.cases.length}
        >
          <Plus size={17} />
          Schedule follow-up
        </button>
      </PageHead>
      <div className="view-tabs">
        {[
          ["open", "Upcoming"],
          ["done", "Completed"],
          ["all", "All follow-ups"],
        ].map(([value, label]) => (
          <button
            key={value}
            className={filter === value ? "active" : ""}
            onClick={() => setFilter(value)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="task-list">
        {tasks.map((t) => (
          <div
            className={`task-row ${t.completedAt ? "complete" : ""}`}
            key={t.id}
          >
            <button
              className="check-control"
              aria-label={`${t.completedAt ? "Reopen" : "Complete"} ${t.title}`}
              disabled={busy === t.id}
              onClick={async () => {
                setBusy(t.id);
                await run(
                  () =>
                    api(`/tasks/${t.id}`, "PATCH", { done: !t.completedAt }),
                  t.completedAt ? "Follow-up reopened" : "Follow-up completed",
                );
                setBusy(null);
              }}
            >
              {t.completedAt && <Check size={14} />}
            </button>
            <div>
              <strong>{t.title}</strong>
              <Link to={`/cases/${t.caseId}`}>
                {data.cases.find((c) => c.id === t.caseId)?.counterparty}
                <ArrowUpRight size={12} />
              </Link>
            </div>
            <span
              className={
                !t.completedAt && t.dueDate < today() ? "overdue-text" : "muted"
              }
            >
              {date(t.dueDate)}
            </span>
          </div>
        ))}
        {!tasks.length && (
          <Empty
            title={
              filter === "done"
                ? "No completed follow-ups yet"
                : "Nothing waiting on you"
            }
          />
        )}
      </div>
      {create && <TaskForm close={() => setCreate(false)} />}
    </>
  );
}

function ActivityPage() {
  const { data } = useWorkspace();
  const [query, setQuery] = useState("");
  const events = data.events.filter((e) =>
    `${e.action} ${e.detail}`.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <>
      <PageHead
        title="Activity log"
        description="A lasting record of every change in your workspace."
      />
      <div className="filterbar">
        <label className="search-field">
          <Search size={17} />
          <input
            aria-label="Search activity"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search activity..."
          />
        </label>
        <span className="muted">{events.length} events</span>
      </div>
      <div className="activity-list full">
        {events.map((e) => (
          <div className="activity-row" key={e.id}>
            <span className="event-icon">
              <Activity size={17} />
            </span>
            <div>
              <strong>{e.action}</strong>
              <p>{e.detail}</p>
              {e.entityType === "case" && (
                <Link className="text-link" to={`/cases/${e.entityId}`}>
                  View case
                  <ArrowUpRight size={13} />
                </Link>
              )}
            </div>
            <time>
              {new Date(e.createdAt).toLocaleString("en-IN", {
                day: "numeric",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </time>
          </div>
        ))}
        {!events.length && <Empty title="No matching activity" />}
      </div>
    </>
  );
}

function SettingsPage() {
  const { data, run, refresh } = useWorkspace();
  const [busy, setBusy] = useState(false);
  return (
    <>
      <PageHead
        title="Workspace settings"
        description="Your business details and connected services."
      />
      <div className="settings-layout">
        <section>
          <div className="section-title">
            <div>
              <h2>Business profile</h2>
              <p>Used in case packets and prepared correspondence.</p>
            </div>
          </div>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              setBusy(true);
              await run(
                () => api("/workspace", "PATCH", Object.fromEntries(f)),
                "Workspace details saved",
              );
              setBusy(false);
            }}
          >
            <div className="settings-fields">
              <Field label="Business name">
                <input
                  name="name"
                  defaultValue={data.workspace.name}
                  required
                  maxLength={200}
                />
              </Field>
              <Field label="Owner name">
                <input
                  name="owner"
                  defaultValue={data.workspace.owner}
                  required
                  maxLength={200}
                />
              </Field>
              <Field label="Business email">
                <input
                  name="email"
                  type="email"
                  defaultValue={data.workspace.email}
                  required
                />
              </Field>
              <Field label="Business address">
                <textarea
                  name="address"
                  defaultValue={data.workspace.address}
                  maxLength={500}
                  rows={3}
                />
              </Field>
            </div>
            <Submit busy={busy}>
              <Check size={16} />
              Save changes
            </Submit>
          </form>
        </section>
        <aside>
          <section className="settings-section">
            <h2>Connected services</h2>
            {[
              ["Evidence storage", "S3", data.capabilities.s3],
              ["Image extraction", "Textract", data.capabilities.textract],
              ["Assisted drafting", "Bedrock", data.capabilities.bedrock],
            ].map(([label, provider, enabled]) => (
              <div className="integration-row" key={String(provider)}>
                <div>
                  <strong>{label}</strong>
                  <small>Amazon {provider}</small>
                </div>
                <span
                  className={`config-status ${enabled ? "configured" : ""}`}
                >
                  {enabled ? "Configured" : "Not connected"}
                </span>
              </div>
            ))}
            <p className="small-note">
              Region: {data.capabilities.region}. Configured services are
              verified when an operation runs.
            </p>
          </section>
          <section className="settings-section">
            <h2>Workspace data</h2>
            <p className="muted">
              Export cases, transactions, evidence metadata and history.
              Original evidence files remain in storage.
            </p>
            <a className="btn" href="/api/export" download>
              <Download size={16} />
              Export workspace
            </a>
          </section>
          <section className="settings-section">
            <h2>Access</h2>
            <p className="muted">
              {data.capabilities.auth
                ? "Workspace password protection is enabled."
                : "Local single-owner workspace. Password protection is not enabled."}
            </p>
            {data.capabilities.auth && (
              <button
                className="btn"
                onClick={async () => {
                  await api("/logout", "POST");
                  await refresh().catch(() => {});
                }}
              >
                <LogOut size={16} />
                Sign out
              </button>
            )}
          </section>
        </aside>
      </div>
    </>
  );
}
