export type CaseKind = "payment" | "document" | "dispute";
export type CaseStatus = "open" | "in_progress" | "resolved";
export type AmendmentKind = "correction" | "agreed_change";

/** Records are never destroyed; they are archived out of the working views. */
export interface Archivable {
  archivedAt?: string | null;
  archivedBy?: string;
  archiveReason?: string;
  /** Seeded demonstration record, not owner data. */
  sample?: boolean;
}
export const isArchived = (record: Archivable) => Boolean(record.archivedAt);
export const isLive = (record: Archivable) => !record.archivedAt;

export interface RecoveryCase extends Archivable {
  id: string;
  number: string;
  title: string;
  kind: CaseKind;
  counterparty: string;
  invoice: string;
  amount: number;
  dueDate: string;
  summary: string;
  status: CaseStatus;
  createdAt: string;
}
export interface Payment {
  id: string;
  caseId: string;
  amount: number;
  date: string;
  reference: string;
  key: string;
  createdAt: string;
  /** Set on a correcting entry: the id of the payment it reverses. */
  reversalOf?: string;
  /** Set on an original entry once a reversal has been recorded against it. */
  reversedBy?: string;
  /** Why the reversal was recorded. */
  reason?: string;
}
export interface Evidence extends Archivable {
  id: string;
  caseId: string;
  name: string;
  mime: string;
  size: number;
  digest: string;
  text: string;
  provider: string;
  createdAt: string;
  cloudKey?: string;
}
export interface Draft {
  id: string;
  caseId: string;
  kind: string;
  title: string;
  body: string;
  revision: number;
  createdAt: string;
  updatedAt: string;
  provider: string;
}
export interface Task extends Archivable {
  id: string;
  caseId: string;
  title: string;
  dueDate: string;
  completedAt: string | null;
}
export interface CheckItem {
  id: string;
  caseId: string;
  label: string;
  done: boolean;
}
export interface Store extends Archivable {
  id: string;
  name: string;
  locality: string;
}
export interface Lot extends Archivable {
  id: string;
  storeId: string;
  sku: string;
  product: string;
  category: string;
  unit: string;
  quantity: number;
  reserved: number;
  expiry: string;
  batch: string;
}
export interface Transfer {
  id: string;
  lotId: string;
  destination: string;
  quantity: number;
  status: "reserved" | "dispatched" | "received" | "cancelled";
  createdAt: string;
  updatedAt: string;
}
export interface Activity {
  id: string;
  entityId: string;
  entityType: string;
  action: string;
  detail: string;
  createdAt: string;
}
/**
 * A field-level change with both sides recorded, so any single entry answers
 * "what was this before?" without replaying the log. Entries are hash-chained:
 * altering one breaks every digest after it.
 */
export interface Amendment {
  id: string;
  entityType: string;
  entityId: string;
  field: string;
  from: string;
  to: string;
  kind: AmendmentKind;
  reason: string;
  actorId: string | null;
  actorLabel: string;
  createdAt: string;
  previousDigest: string;
  digest: string;
}
export interface Workspace {
  name: string;
  owner: string;
  email: string;
  address: string;
  sample: boolean;
}
export interface State {
  workspace: Workspace;
  cases: RecoveryCase[];
  payments: Payment[];
  evidence: Evidence[];
  documents: Draft[];
  tasks: Task[];
  checklist: CheckItem[];
  stores: Store[];
  lots: Lot[];
  transfers: Transfer[];
  events: Activity[];
  amendments: Amendment[];
}
export interface Capabilities {
  bedrock: boolean;
  textract: boolean;
  s3: boolean;
  auth: boolean;
  region: string;
  mode: string;
}
export type Bootstrap = State & { capabilities: Capabilities };
export type CaseDetail = RecoveryCase & {
  payments: Payment[];
  evidence: Evidence[];
  documents: Draft[];
  tasks: Task[];
  checklist: CheckItem[];
  events: Activity[];
  amendments: Amendment[];
};

/** Fields that may be amended, split by how materially they change the claim. */
export const FINANCIAL_CASE_FIELDS = ["amount", "dueDate", "invoice"] as const;
export const DESCRIPTIVE_CASE_FIELDS = ["title", "counterparty"] as const;
export const AMENDABLE_CASE_FIELDS = [
  ...FINANCIAL_CASE_FIELDS,
  ...DESCRIPTIVE_CASE_FIELDS,
] as const;
export type AmendableCaseField = (typeof AMENDABLE_CASE_FIELDS)[number];

export const ARCHIVABLE_ENTITIES = [
  "case",
  "task",
  "evidence",
  "store",
  "lot",
] as const;
export type ArchivableEntity = (typeof ARCHIVABLE_ENTITIES)[number];
