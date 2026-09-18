import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
  useRef,
} from "react";
import {
  X,
  LoaderCircle,
  FolderOpen,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import type { Bootstrap, RecoveryCase } from "../shared/types";
import { calendarDay } from "../shared/calendar";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code = "REQUEST_FAILED",
  ) {
    super(message);
  }
}
export async function api<T>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const response = await fetch(`/api${path}`, {
    method,
    credentials: "same-origin",
    headers:
      body instanceof FormData
        ? undefined
        : { "Content-Type": "application/json" },
    body:
      body === undefined
        ? undefined
        : body instanceof FormData
          ? body
          : JSON.stringify(body),
  });
  if (!response.ok) {
    const data = await response
      .json()
      .catch(() => ({ error: "Connection failed. Try again." }));
    if (response.status === 401)
      window.dispatchEvent(new Event("claimchain:unauthenticated"));
    throw new ApiError(
      data.error || "Request failed",
      response.status,
      data.code || "REQUEST_FAILED",
    );
  }
  return response.json();
}
export const money = (paise: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: paise % 100 ? 2 : 0,
  }).format(paise / 100);
export const date = (value: string) =>
  new Date(
    value.length === 10 ? `${value}T12:00:00` : value,
  ).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
export const today = () => calendarDay();
export const fullDate = (value: string) =>
  new Date(`${value}T12:00:00`).toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
export const initials = (value: string) =>
  value
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0])
    .join("")
    .toUpperCase();
export const statusLabel = (value: string) =>
  ({
    open: "Open",
    in_progress: "In progress",
    resolved: "Resolved",
    reserved: "Reserved",
    dispatched: "In transit",
    received: "Received",
    cancelled: "Cancelled",
  })[value] || value;
export const balance = (data: Bootstrap, c: RecoveryCase) =>
  c.amount -
  data.payments
    .filter((p) => p.caseId === c.id)
    .reduce((n, p) => n + p.amount, 0);

interface ContextValue {
  data: Bootstrap;
  refresh: () => Promise<void>;
  run: <T>(work: () => Promise<T>, message?: string) => Promise<T | undefined>;
}
const WorkspaceContext = createContext<ContextValue | null>(null);
export const useWorkspace = () => {
  const value = useContext(WorkspaceContext);
  if (!value) throw new Error("Workspace unavailable");
  return value;
};

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<Bootstrap | null>(null);
  const [error, setError] = useState("");
  const refreshVersion = useRef(0);
  const refresh = useCallback(async () => {
    const version = ++refreshVersion.current;
    try {
      const next = await api<Bootstrap>("/bootstrap");
      if (version !== refreshVersion.current) return;
      setData(next);
      setError("");
    } catch (e) {
      if (version !== refreshVersion.current) return;
      if (e instanceof ApiError && e.status === 401) setData(null);
      else setError((e as Error).message);
      throw e;
    }
  }, []);
  useEffect(() => {
    void refresh().catch(() => {});
  }, [refresh]);
  async function run<T>(work: () => Promise<T>, message?: string) {
    try {
      const result = await work();
      await refresh();
      if (message) toast.success(message);
      return result;
    } catch (e) {
      toast.error((e as Error).message);
      return undefined;
    }
  }
  if (!data)
    return (
      <div className="boot-screen">
        <div className="wordmark">
          ClaimChain<span>.</span>
        </div>
        {error ? (
          <>
            <p role="alert">{error}</p>
            <button
              className="btn"
              onClick={() => void refresh().catch(() => {})}
            >
              Try again
            </button>
          </>
        ) : (
          <>
            <div className="skeleton" />
            <div className="skeleton short" />
            <span className="muted">Opening your workspace...</span>
          </>
        )}
      </div>
    );
  return (
    <WorkspaceContext.Provider value={{ data, refresh, run }}>
      {error && (
        <div className="connection-error" role="alert">
          {error}{" "}
          <button onClick={() => void refresh().catch(() => {})}>
            Reconnect
          </button>
        </div>
      )}
      {children}
    </WorkspaceContext.Provider>
  );
}

export function usePagination<T>(items: T[], pageSize = 8) {
  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  useEffect(
    () => setPage((current) => Math.min(current, pageCount)),
    [pageCount],
  );
  return {
    page,
    pageCount,
    setPage,
    items: items.slice((page - 1) * pageSize, page * pageSize),
    total: items.length,
    from: items.length ? (page - 1) * pageSize + 1 : 0,
    to: Math.min(page * pageSize, items.length),
  };
}

export function Pagination({
  page,
  pageCount,
  setPage,
  from,
  to,
  total,
}: {
  page: number;
  pageCount: number;
  setPage: (page: number) => void;
  from: number;
  to: number;
  total: number;
}) {
  if (pageCount <= 1) return null;
  return (
    <nav className="pagination" aria-label="Pagination">
      <span>
        {from}-{to} of {total}
      </span>
      <div>
        <button
          className="icon-btn"
          aria-label="Previous page"
          title="Previous page"
          disabled={page === 1}
          onClick={() => setPage(page - 1)}
        >
          <ChevronLeft size={17} />
        </button>
        <strong>
          Page {page} of {pageCount}
        </strong>
        <button
          className="icon-btn"
          aria-label="Next page"
          title="Next page"
          disabled={page === pageCount}
          onClick={() => setPage(page + 1)}
        >
          <ChevronRight size={17} />
        </button>
      </div>
    </nav>
  );
}

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
export function Badge({ status }: { status: string }) {
  return (
    <span className={`badge ${status}`}>
      <span />
      {statusLabel(status)}
    </span>
  );
}
export function Empty({
  title,
  detail,
  action,
}: {
  title: string;
  detail?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <FolderOpen size={30} strokeWidth={1.4} />
      <h3>{title}</h3>
      {detail && <p>{detail}</p>}
      {action}
    </div>
  );
}
export function Modal({
  title,
  children,
  close,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  close: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    ref.current?.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`modal ${wide ? "wide" : ""}`}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      onClick={(e) => {
        if (e.target === ref.current) {
          const r = ref.current.getBoundingClientRect();
          if (
            e.clientX < r.left ||
            e.clientX > r.right ||
            e.clientY < r.top ||
            e.clientY > r.bottom
          )
            close();
        }
      }}
      aria-labelledby="dialog-title"
    >
      <div className="modal-head">
        <h2 id="dialog-title">{title}</h2>
        <button
          className="icon-btn"
          aria-label="Close dialog"
          title="Close"
          onClick={close}
        >
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function Submit({
  busy,
  children,
}: {
  busy: boolean;
  children: ReactNode;
}) {
  return (
    <button className="btn primary" type="submit" disabled={busy}>
      {busy && <LoaderCircle size={16} className="spin" />}
      {children}
    </button>
  );
}
export function PageHead({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      <div className="head-actions">{children}</div>
    </div>
  );
}
