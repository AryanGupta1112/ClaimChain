export type CaseKind = "payment" | "document" | "dispute";
export type CaseStatus = "open" | "in_progress" | "resolved";
export interface RecoveryCase {
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
}
export interface Evidence {
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
export interface Task {
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
export interface Store {
  id: string;
  name: string;
  locality: string;
}
export interface Lot {
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
};
