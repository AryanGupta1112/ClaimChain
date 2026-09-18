import { useState } from "react";
import {
  Plus,
  Search,
  ArrowRight,
  ArrowUpRight,
  PackageCheck,
  Truck,
  Ban,
  Boxes,
  Package,
  Store as StoreIcon,
  Check,
} from "lucide-react";
import {
  api,
  useWorkspace,
  date,
  today,
  Badge,
  Field,
  Modal,
  Submit,
  PageHead,
  Empty,
  Pagination,
  usePagination,
} from "./lib";
import type { Lot } from "../shared/types";
import { useAuth } from "./auth";
import { ArchiveForm, RestoreButton } from "./Corrections";

export function StockPage() {
  const { data, run } = useWorkspace();
  const { can } = useAuth();
  const [tab, setTab] = useState("inventory"),
    [query, setQuery] = useState(""),
    [store, setStore] = useState("all"),
    [create, setCreate] = useState(false),
    [newStore, setNewStore] = useState(false),
    [lot, setLot] = useState<Lot | null>(null),
    [archiveLot, setArchiveLot] = useState<Lot | null>(null),
    [busy, setBusy] = useState("");
  // Archived stock and stores keep their history but leave the working views.
  const showArchived = store === "archived";
  const liveStores = data.stores.filter((s) => !s.archivedAt);
  const lots = data.lots.filter(
    (l) =>
      `${l.product} ${l.sku} ${l.batch}`
        .toLowerCase()
        .includes(query.toLowerCase()) &&
      (showArchived
        ? l.archivedAt
        : !l.archivedAt && (store === "all" || l.storeId === store)),
  );
  const active = data.transfers.filter((t) =>
    ["reserved", "dispatched"].includes(t.status),
  );
  // A transfer whose lot is archived would otherwise render from a missing
  // record, so transfers are scoped to lots that are still present.
  const visibleTransfers = data.transfers.filter((t) =>
    data.lots.some((l) => l.id === t.lotId && !l.archivedAt),
  );
  const inventoryPages = usePagination(lots, 6);
  const transferPages = usePagination(visibleTransfers, 6);
  return (
    <>
      <PageHead
        title="Stock exchange"
        description="Move available stock to the store that needs it."
      >
        {can("manage_workspace") && (
          <button className="btn" onClick={() => setNewStore(true)}>
            <StoreIcon size={16} />
            Add store
          </button>
        )}
        {can("manage_inventory") && (
          <button
            className="btn primary"
            onClick={() => setCreate(true)}
            disabled={!liveStores.length}
          >
            <Plus size={17} />
            List stock
          </button>
        )}
      </PageHead>
      <div className="stock-summary">
        <div>
          <StoreIcon size={21} />
          <span>
            <strong>{liveStores.length}</strong> connected stores
          </span>
        </div>
        <div>
          <Boxes size={21} />
          <span>
            <strong>
              {
                data.lots.filter(
                  (l) =>
                    l.quantity - l.reserved > 0 &&
                    l.expiry >= today() &&
                    !l.archivedAt,
                ).length
              }
            </strong>{" "}
            available lots
          </span>
        </div>
        <div>
          <Truck size={21} />
          <span>
            <strong>{active.length}</strong> active transfers
          </span>
        </div>
        <div>
          <PackageCheck size={21} />
          <span>
            <strong>
              {data.transfers.filter((t) => t.status === "received").length}
            </strong>{" "}
            completed handoffs
          </span>
        </div>
      </div>
      <div className="view-tabs">
        <button
          className={tab === "inventory" ? "active" : ""}
          onClick={() => setTab("inventory")}
        >
          Available inventory
          <span>{data.lots.filter((l) => !l.archivedAt).length}</span>
        </button>
        <button
          className={tab === "transfers" ? "active" : ""}
          onClick={() => setTab("transfers")}
        >
          Transfers<span>{visibleTransfers.length}</span>
        </button>
      </div>
      {tab === "inventory" ? (
        <>
          <div className="filterbar">
            <label className="search-field">
              <Search size={17} />
              <input
                aria-label="Search inventory"
                placeholder="Search products, SKUs or batches..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            <select
              aria-label="Filter by store"
              value={store}
              onChange={(e) => setStore(e.target.value)}
            >
              <option value="all">All stores</option>
              {liveStores.map((s) => (
                <option value={s.id} key={s.id}>
                  {s.name}
                </option>
              ))}
              <option value="archived">Archived stock</option>
            </select>
          </div>
          <div className="inventory-grid">
            {inventoryPages.items.map((l, index) => {
              const owner = data.stores.find((s) => s.id === l.storeId);
              const available = l.quantity - l.reserved;
              return (
                <article className="inventory-item" key={l.id}>
                  <div className="inventory-header">
                    <span className={`product-symbol color-${index % 4}`}>
                      <Package size={28} strokeWidth={1.4} />
                    </span>
                    <span
                      className={`stock-tag ${l.archivedAt ? "archived" : l.expiry < today() ? "expired" : ""}`}
                    >
                      {l.archivedAt
                        ? "Archived"
                        : l.expiry < today()
                          ? "Expired"
                          : "Available stock"}
                    </span>
                  </div>
                  <div className="inventory-name">
                    <span>{l.category}</span>
                    <h2>{l.product}</h2>
                    <small>
                      {l.sku} · Batch {l.batch}
                    </small>
                  </div>
                  <div className="store-line">
                    <StoreIcon size={14} />
                    <span>
                      {owner?.name || "Unknown store"}
                      <small>{owner?.locality || ""}</small>
                    </span>
                  </div>
                  <div className="inventory-numbers">
                    <div>
                      <strong>{available}</strong>
                      <span>{l.unit} available</span>
                    </div>
                    <div>
                      <strong>{l.reserved}</strong>
                      <span>reserved</span>
                    </div>
                  </div>
                  <div className="inventory-bottom">
                    <span>Expires {date(l.expiry)}</span>
                    {can("manage_inventory") && l.archivedAt && (
                      <RestoreButton entity="lot" id={l.id} />
                    )}
                    {can("manage_inventory") && !l.archivedAt && (
                      <button
                        className="text-link subtle"
                        onClick={() => setArchiveLot(l)}
                      >
                        Archive
                      </button>
                    )}
                    {can("manage_inventory") && !l.archivedAt && (
                      <button
                        className="text-link"
                        disabled={
                          available <= 0 ||
                          l.expiry < today() ||
                          liveStores.length < 2
                        }
                        title={
                          liveStores.length < 2
                            ? "Add a second store before transferring stock"
                            : undefined
                        }
                        onClick={() => setLot(l)}
                      >
                        Transfer stock
                        <ArrowUpRight size={16} />
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
          {!lots.length && <Empty title="No stock matches this view" />}
          <Pagination {...inventoryPages} />
        </>
      ) : (
        <div className="transfer-list">
          {transferPages.items.map((t) => {
            const l = data.lots.find((l) => l.id === t.lotId);
            if (!l) return null;
            return (
              <article className="transfer-item" key={t.id}>
                <div className="transfer-top">
                  <div className="transfer-name">
                    <span className="event-icon">
                      <Truck size={21} />
                    </span>
                    <div>
                      <h2>{l.product}</h2>
                      <small>
                        {t.quantity} {l.unit} · {l.batch} · {date(t.createdAt)}
                      </small>
                    </div>
                  </div>
                  <Badge status={t.status} />
                </div>
                <div className="transfer-route">
                  <span>
                    {data.stores.find((s) => s.id === l.storeId)?.name}
                  </span>
                  <ArrowRight size={20} />
                  <span>
                    {data.stores.find((s) => s.id === t.destination)?.name}
                  </span>
                </div>
                <div className="transfer-footer">
                  <span className="muted">
                    {t.status === "reserved"
                      ? "Units reserved at the source store."
                      : t.status === "dispatched"
                        ? "Awaiting confirmation from the receiving store."
                        : t.status === "received"
                          ? "Receipt confirmed. Both inventories updated."
                          : "Reservation released."}
                  </span>
                  <div>
                    {can("manage_inventory") && t.status === "reserved" && (
                      <button
                        className="btn small-btn"
                        disabled={busy === t.id}
                        onClick={async () => {
                          setBusy(t.id);
                          await run(
                            () =>
                              api(`/transfers/${t.id}/transition`, "POST", {
                                status: "cancelled",
                              }),
                            "Reservation released",
                          );
                          setBusy("");
                        }}
                      >
                        <Ban size={15} />
                        Cancel
                      </button>
                    )}
                    {can("manage_inventory") &&
                      ["reserved", "dispatched"].includes(t.status) && (
                        <button
                          className="btn primary small-btn"
                          disabled={busy === t.id}
                          onClick={async () => {
                            setBusy(t.id);
                            await run(
                              () =>
                                api(`/transfers/${t.id}/transition`, "POST", {
                                  status:
                                    t.status === "reserved"
                                      ? "dispatched"
                                      : "received",
                                }),
                              t.status === "reserved"
                                ? "Transfer dispatched"
                                : "Receipt confirmed; inventory updated",
                            );
                            setBusy("");
                          }}
                        >
                          {t.status === "reserved" ? (
                            <Truck size={15} />
                          ) : (
                            <PackageCheck size={15} />
                          )}
                          {t.status === "reserved"
                            ? "Mark dispatched"
                            : "Confirm receipt"}
                        </button>
                      )}
                  </div>
                </div>
              </article>
            );
          })}
          {!data.transfers.length && (
            <Empty
              title="No transfers yet"
              detail="Reserve available stock to start a store-to-store handoff."
              action={
                <button className="btn" onClick={() => setTab("inventory")}>
                  Browse inventory
                  <ArrowRight size={16} />
                </button>
              }
            />
          )}
          <Pagination {...transferPages} />
        </div>
      )}
      {create && can("manage_inventory") && (
        <StockForm close={() => setCreate(false)} />
      )}
      {lot && can("manage_inventory") && (
        <TransferForm
          lot={lot}
          close={() => setLot(null)}
          complete={() => {
            setLot(null);
            setTab("transfers");
          }}
        />
      )}
      {newStore && can("manage_workspace") && (
        <StoreForm close={() => setNewStore(false)} />
      )}
      {archiveLot && can("manage_inventory") && (
        <ArchiveForm
          entity="lot"
          id={archiveLot.id}
          label={archiveLot.product}
          close={() => setArchiveLot(null)}
        />
      )}
    </>
  );
}

function StoreForm({ close }: { close: () => void }) {
  const { run } = useWorkspace();
  const [busy, setBusy] = useState(false);
  return (
    <Modal title="Add a store" close={close}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          setBusy(true);
          const result = await run(
            () => api("/stores", "POST", Object.fromEntries(f)),
            "Store added to your network",
          );
          setBusy(false);
          if (result) close();
        }}
      >
        <div className="modal-body">
          <Field label="Store name">
            <input name="name" required maxLength={200} autoFocus />
          </Field>
          <Field label="Locality">
            <input name="locality" required maxLength={200} />
          </Field>
        </div>
        <div className="modal-actions">
          <button type="button" className="btn" onClick={close}>
            Cancel
          </button>
          <Submit busy={busy}>
            <Plus size={16} />
            Add store
          </Submit>
        </div>
      </form>
    </Modal>
  );
}

function StockForm({ close }: { close: () => void }) {
  const { data, run } = useWorkspace();
  const [busy, setBusy] = useState(false);
  return (
    <Modal title="List available stock" close={close}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          const f = new FormData(e.currentTarget);
          const result = await run(
            () =>
              api("/stock", "POST", {
                ...Object.fromEntries(f),
                quantity: Number(f.get("quantity")),
              }),
            "Stock lot listed",
          );
          setBusy(false);
          if (result) close();
        }}
      >
        <div className="modal-body">
          <Field label="Store">
            <select name="storeId">
              {data.stores
                .filter((s) => !s.archivedAt)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
            </select>
          </Field>
          <Field label="Product name">
            <input name="product" required maxLength={200} autoFocus />
          </Field>
          <div className="form-grid">
            <Field label="SKU">
              <input name="sku" required maxLength={200} />
            </Field>
            <Field label="Batch">
              <input name="batch" required maxLength={200} />
            </Field>
          </div>
          <Field label="Category">
            <select name="category">
              <option>Staples</option>
              <option>Beverages</option>
              <option>Cooking essentials</option>
              <option>Household</option>
              <option>Personal care</option>
              <option>Other retail</option>
            </select>
          </Field>
          <div className="form-grid">
            <Field label="Quantity">
              <input
                name="quantity"
                type="number"
                min="1"
                max="1000000"
                step="1"
                required
              />
            </Field>
            <Field label="Unit">
              <select name="unit">
                <option>packs</option>
                <option>bags</option>
                <option>bottles</option>
                <option>bars</option>
                <option>units</option>
                <option>cartons</option>
              </select>
            </Field>
          </div>
          <Field label="Expiry / best-before date">
            <input name="expiry" type="date" min={today()} required />
          </Field>
        </div>
        <div className="modal-actions">
          <button type="button" className="btn" onClick={close}>
            Cancel
          </button>
          <Submit busy={busy}>
            <Plus size={16} />
            List stock
          </Submit>
        </div>
      </form>
    </Modal>
  );
}

function TransferForm({
  lot,
  close,
  complete,
}: {
  lot: Lot;
  close: () => void;
  complete: () => void;
}) {
  const { data, run } = useWorkspace();
  const [busy, setBusy] = useState(false);
  return (
    <Modal title="Reserve a stock transfer" close={close}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          const f = new FormData(e.currentTarget);
          const result = await run(
            () =>
              api("/transfers", "POST", {
                lotId: lot.id,
                destination: f.get("destination"),
                quantity: Number(f.get("quantity")),
              }),
            "Stock reserved for transfer",
          );
          setBusy(false);
          if (result) complete();
        }}
      >
        <div className="modal-body">
          <div className="inline-summary">
            <span>{lot.product}</span>
            <strong>
              {lot.quantity - lot.reserved} {lot.unit} available
            </strong>
          </div>
          <Field label="From store">
            <input
              readOnly
              value={data.stores.find((s) => s.id === lot.storeId)?.name || ""}
            />
          </Field>
          <Field label="Receiving store">
            <select name="destination" required>
              {data.stores
                .filter((s) => !s.archivedAt && s.id !== lot.storeId)
                .map((s) => (
                  <option value={s.id} key={s.id}>
                    {s.name} - {s.locality}
                  </option>
                ))}
            </select>
          </Field>
          <Field label={`Quantity (${lot.unit})`}>
            <input
              name="quantity"
              type="number"
              min="1"
              max={lot.quantity - lot.reserved}
              step="1"
              defaultValue="1"
              required
              autoFocus
            />
          </Field>
          <p className="small-note">
            Units are reserved now. The receiving inventory is credited when
            receipt is confirmed.
          </p>
        </div>
        <div className="modal-actions">
          <button type="button" className="btn" onClick={close}>
            Cancel
          </button>
          <Submit busy={busy}>
            <Check size={16} />
            Reserve stock
          </Submit>
        </div>
      </form>
    </Modal>
  );
}
