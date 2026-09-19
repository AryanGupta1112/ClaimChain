import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  Activity,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleStop,
  LoaderCircle,
  Play,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  UserRoundCog,
  X,
} from "lucide-react";
import { toast } from "sonner";
import type {
  AuthRole,
  AuthUser,
  PageResult,
  RoleDefinition,
  SecurityAuditEntry,
  UserScopes,
} from "../shared/auth";
import type { SimulationStatus } from "../shared/types";
import {
  api,
  Empty,
  Field,
  Modal,
  PageHead,
  Submit,
  useWorkspace,
} from "./lib";

type Editor = { user?: AuthUser } | null;
function ServerPager({
  page,
  totalPages,
  total,
  onPage,
}: {
  page: number;
  totalPages: number;
  total: number;
  onPage: (page: number) => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <nav className="pagination" aria-label="Pagination">
      <span>{total} records</span>
      <div>
        <button
          className="icon-btn"
          aria-label="Previous page"
          title="Previous page"
          disabled={page === 1}
          onClick={() => onPage(page - 1)}
        >
          <ChevronLeft size={17} />
        </button>
        <strong>
          Page {page} of {totalPages}
        </strong>
        <button
          className="icon-btn"
          aria-label="Next page"
          title="Next page"
          disabled={page === totalPages}
          onClick={() => onPage(page + 1)}
        >
          <ChevronRight size={17} />
        </button>
      </div>
    </nav>
  );
}

export function AccessPage({
  simulation,
  onSimulationChange,
}: {
  simulation: SimulationStatus | null;
  onSimulationChange: (status: SimulationStatus) => void;
}) {
  const { data, refresh: refreshWorkspace } = useWorkspace();
  const [tab, setTab] = useState<"users" | "audit" | "simulation">("users");
  const [roles, setRoles] = useState<RoleDefinition[]>([]);
  const [users, setUsers] = useState<PageResult<AuthUser> | null>(null);
  const [audit, setAudit] = useState<PageResult<SecurityAuditEntry> | null>(
    null,
  );
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [editor, setEditor] = useState<Editor>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (tab === "users") {
      const [roleResult, userResult] = await Promise.all([
        api<{ roles: RoleDefinition[] }>("/admin/roles"),
        api<PageResult<AuthUser>>(
          `/admin/users?page=${page}&pageSize=8&q=${encodeURIComponent(query)}`,
        ),
      ]);
      setRoles(roleResult.roles);
      setUsers(userResult);
    } else if (tab === "audit") {
      setAudit(
        await api<PageResult<SecurityAuditEntry>>(
          `/admin/security-audit?page=${page}&pageSize=10`,
        ),
      );
    } else
      onSimulationChange(await api<SimulationStatus>("/simulation/status"));
  }, [onSimulationChange, page, query, tab]);

  useEffect(() => {
    void load().catch((error) => toast.error((error as Error).message));
  }, [load]);
  useEffect(() => setPage(1), [query, tab]);

  const remove = async (user: AuthUser) => {
    if (
      !confirm(`Delete ${user.displayName}'s account? This cannot be undone.`)
    )
      return;
    setBusy(true);
    try {
      await api(`/admin/users/${user.id}`, "DELETE");
      toast.success("Account deleted");
      await load();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHead
        title="Access control"
        description="Provision people, constrain operating scope, and review security decisions."
      >
        {tab === "users" && (
          <button className="btn primary" onClick={() => setEditor({})}>
            <Plus size={16} />
            Add person
          </button>
        )}
      </PageHead>
      <div
        className="segmented access-tabs"
        role="tablist"
        aria-label="Access views"
      >
        <button
          className={tab === "users" ? "active" : ""}
          onClick={() => setTab("users")}
        >
          <UserRoundCog size={16} />
          People
        </button>
        <button
          className={tab === "audit" ? "active" : ""}
          onClick={() => setTab("audit")}
        >
          <ShieldCheck size={16} />
          Security audit
        </button>
        <button
          className={tab === "simulation" ? "active" : ""}
          onClick={() => setTab("simulation")}
        >
          <Activity size={16} />
          Data ingestion
        </button>
      </div>

      {tab === "users" && (
        <section className="access-section">
          <div className="filterbar">
            <label className="search-field">
              <Search size={17} />
              <input
                aria-label="Search people"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search name, email, or username..."
              />
            </label>
            <span className="muted">{users?.total ?? 0} people</span>
          </div>
          <div className="table-wrap">
            <table className="data-table access-table">
              <thead>
                <tr>
                  <th>Person</th>
                  <th>Role</th>
                  <th>Scope</th>
                  <th>Status</th>
                  <th>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {users?.items.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <div className="person-cell">
                        <span className="avatar small">
                          {user.displayName
                            .split(" ")
                            .map((part) => part[0])
                            .slice(0, 2)
                            .join("")}
                        </span>
                        <div>
                          <strong>{user.displayName}</strong>
                          <small>
                            {user.email} · @{user.username}
                          </small>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="role-chip">
                        {roles.find((role) => role.id === user.role)?.label ||
                          user.role}
                      </span>
                    </td>
                    <td>
                      {user.role === "recovery_operator"
                        ? `${user.scopes.caseIds.length} cases · ${user.scopes.storeIds.length} stores`
                        : "All workspace"}
                    </td>
                    <td>
                      <div className="status-stack">
                        <span
                          className={`config-status ${user.active ? "configured" : ""}`}
                        >
                          {user.active ? "Active" : "Disabled"}
                        </span>
                        <small>
                          {user.verified
                            ? "Email verified"
                            : "Verification pending"}
                        </small>
                      </div>
                    </td>
                    <td>
                      <div className="row-actions">
                        <button
                          className="btn compact"
                          onClick={() => setEditor({ user })}
                        >
                          Edit
                        </button>
                        <button
                          className="icon-btn danger-icon"
                          aria-label={`Delete ${user.displayName}`}
                          title="Delete account"
                          disabled={busy}
                          onClick={() => void remove(user)}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {users && !users.items.length && (
              <Empty
                title="No matching people"
                detail="Try a different search or provision a new account."
              />
            )}
          </div>
          {users && (
            <ServerPager
              page={users.page}
              totalPages={users.pages}
              total={users.total}
              onPage={setPage}
            />
          )}
        </section>
      )}

      {tab === "audit" && (
        <section className="access-section">
          <div className="audit-list">
            {audit?.items.map((entry) => (
              <article className="audit-row" key={entry.id}>
                <span className="event-icon">
                  <ShieldCheck size={16} />
                </span>
                <div>
                  <strong>{entry.action}</strong>
                  <p>{entry.detail}</p>
                  <small>
                    {entry.actorLabel} · {entry.ip}
                  </small>
                </div>
                <time>
                  {new Date(entry.createdAt).toLocaleString("en-IN", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </time>
              </article>
            ))}
          </div>
          {audit && (
            <ServerPager
              page={audit.page}
              totalPages={audit.pages}
              total={audit.total}
              onPage={setPage}
            />
          )}
        </section>
      )}

      {tab === "simulation" && (
        <section className="simulation-panel">
          <div>
            <span
              className={`live-dot ${simulation?.running ? "" : "paused"}`}
            />
            <p>
              {simulation?.halted
                ? "Ingestion is halted"
                : simulation?.running
                  ? "Automatic ingestion is running"
                  : "Automatic ingestion is paused"}
            </p>
            <h2>{simulation?.nextEvent || "Loading ingestion state..."}</h2>
            <span>
              Synthetic events are clearly labeled and pass through the same
              persistence and activity paths as operator actions.
            </span>
          </div>
          <dl>
            <div>
              <dt>Interval</dt>
              <dd>
                {simulation
                  ? `${Math.round(simulation.intervalMs / 1000)} seconds`
                  : "-"}
              </dd>
            </div>
            <div>
              <dt>Mode</dt>
              <dd>
                {simulation?.enabled ? "Environment enabled" : "Manual only"}
              </dd>
            </div>
          </dl>
          <button
            className="btn primary"
            disabled={busy || simulation?.halted}
            onClick={async () => {
              setBusy(true);
              try {
                const result = await api<{
                  message: string;
                  status: SimulationStatus;
                }>("/simulation/ingest", "POST");
                onSimulationChange(result.status);
                toast.success(result.message);
                await Promise.all([load(), refreshWorkspace()]);
              } catch (error) {
                toast.error((error as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? (
              <LoaderCircle className="spin" size={16} />
            ) : (
              <Play size={16} />
            )}
            {simulation?.halted ? "Ingestion halted" : "Ingest next event"}
          </button>
        </section>
      )}

      {editor && (
        <UserEditor
          user={editor.user}
          roles={roles}
          cases={data.cases.map(({ id, number, counterparty }) => ({
            id,
            label: `${number} · ${counterparty}`,
          }))}
          stores={data.stores.map(({ id, name, locality }) => ({
            id,
            label: `${name} · ${locality}`,
          }))}
          close={() => setEditor(null)}
          saved={async () => {
            setEditor(null);
            await load();
          }}
        />
      )}
    </>
  );
}

function UserEditor({
  user,
  roles,
  cases,
  stores,
  close,
  saved,
}: {
  user?: AuthUser;
  roles: RoleDefinition[];
  cases: { id: string; label: string }[];
  stores: { id: string; label: string }[];
  close: () => void;
  saved: () => Promise<void>;
}) {
  const [role, setRole] = useState<AuthRole>(user?.role || "recovery_operator");
  const [scopes, setScopes] = useState<UserScopes>(
    user?.scopes || { caseIds: [], storeIds: [] },
  );
  const [busy, setBusy] = useState(false);
  const toggle = (kind: keyof UserScopes, id: string) =>
    setScopes((current) => ({
      ...current,
      [kind]: current[kind].includes(id)
        ? current[kind].filter((value) => value !== id)
        : [...current[kind], id],
    }));
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    try {
      const form = new FormData(event.currentTarget);
      const payload: Record<string, unknown> = {
        username: form.get("username"),
        email: form.get("email"),
        displayName: form.get("displayName"),
        role,
        scopes:
          role === "recovery_operator" ? scopes : { caseIds: [], storeIds: [] },
      };
      const password = String(form.get("password") || "");
      if (password) payload.password = password;
      if (user) {
        payload.active = form.get("active") === "on";
        payload.verified = form.get("verified") === "on";
        await api(`/admin/users/${user.id}`, "PATCH", payload);
      } else await api("/admin/users", "POST", payload);
      toast.success(user ? "Account updated" : "Account provisioned");
      await saved();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      title={user ? "Edit account" : "Provision account"}
      close={close}
      wide
    >
      <form onSubmit={submit}>
        <div className="form-grid">
          <Field label="Full name">
            <input
              name="displayName"
              defaultValue={user?.displayName}
              required
              maxLength={200}
            />
          </Field>
          <Field label="Username">
            <input
              name="username"
              defaultValue={user?.username}
              required
              minLength={3}
              maxLength={80}
              autoComplete="off"
            />
          </Field>
          <Field label="Email">
            <input
              name="email"
              type="email"
              defaultValue={user?.email}
              required
            />
          </Field>
          <Field
            label={user ? "New password (optional)" : "Temporary password"}
            hint="12+ characters with upper, lower, number, and symbol"
          >
            <input
              name="password"
              type="password"
              required={!user}
              minLength={12}
              autoComplete="new-password"
            />
          </Field>
        </div>
        <fieldset className="role-picker">
          <legend>Role</legend>
          {roles.map((item) => (
            <label className={role === item.id ? "selected" : ""} key={item.id}>
              <input
                type="radio"
                name="role"
                value={item.id}
                checked={role === item.id}
                onChange={() => setRole(item.id)}
              />
              <span>
                <strong>{item.label}</strong>
                <small>{item.description}</small>
              </span>
              {role === item.id && <Check size={17} />}
            </label>
          ))}
        </fieldset>
        {role === "recovery_operator" && (
          <div className="scope-grid">
            <ScopeList
              title="Assigned cases"
              values={cases}
              selected={scopes.caseIds}
              toggle={(id) => toggle("caseIds", id)}
            />
            <ScopeList
              title="Assigned stores"
              values={stores}
              selected={scopes.storeIds}
              toggle={(id) => toggle("storeIds", id)}
            />
          </div>
        )}
        {user && (
          <div className="switch-row">
            <label>
              <input
                type="checkbox"
                name="active"
                defaultChecked={user.active}
              />
              Account active
            </label>
            <label>
              <input
                type="checkbox"
                name="verified"
                defaultChecked={user.verified}
              />
              Email verified
            </label>
          </div>
        )}
        <div className="modal-actions">
          <button type="button" className="btn" onClick={close}>
            Cancel
          </button>
          <Submit busy={busy}>
            {user ? "Save account" : "Provision account"}
          </Submit>
        </div>
      </form>
    </Modal>
  );
}

function ScopeList({
  title,
  values,
  selected,
  toggle,
}: {
  title: string;
  values: { id: string; label: string }[];
  selected: string[];
  toggle: (id: string) => void;
}) {
  return (
    <fieldset className="scope-list">
      <legend>{title}</legend>
      <div>
        {values.map((item) => (
          <label key={item.id}>
            <input
              type="checkbox"
              checked={selected.includes(item.id)}
              onChange={() => toggle(item.id)}
            />
            <span>{item.label}</span>
          </label>
        ))}
      </div>
      <small>
        {selected.length
          ? `${selected.length} assigned`
          : "No access until items are assigned"}
      </small>
    </fieldset>
  );
}
