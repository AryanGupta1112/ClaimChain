export const AUTH_ROLES = [
  "workspace_admin",
  "recovery_operator",
  "auditor",
] as const;

export type AuthRole = (typeof AUTH_ROLES)[number];

export const CAPABILITIES = [
  "view_dashboard",
  "view_cases",
  "create_cases",
  "manage_cases",
  "amend_financials",
  "record_payments",
  "manage_evidence",
  "prepare_documents",
  "manage_tasks",
  "export_packets",
  "view_inventory",
  "manage_inventory",
  "view_activity",
  "manage_workspace",
  "manage_users",
  "manage_simulation",
] as const;

export type Capability = (typeof CAPABILITIES)[number];

export interface UserScopes {
  caseIds: string[];
  storeIds: string[];
}

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  displayName: string;
  role: AuthRole;
  verified: boolean;
  active: boolean;
  scopes: UserScopes;
  capabilities: Capability[];
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
}

export interface RoleDefinition {
  id: AuthRole;
  label: string;
  description: string;
  scope: "global" | "assigned";
  capabilities: Capability[];
}

const operational: Capability[] = [
  "view_dashboard",
  "view_cases",
  "create_cases",
  "manage_cases",
  "record_payments",
  "manage_evidence",
  "prepare_documents",
  "manage_tasks",
  "export_packets",
  "view_inventory",
  "manage_inventory",
  "view_activity",
];

export const ROLE_DEFINITIONS: Record<AuthRole, RoleDefinition> = {
  workspace_admin: {
    id: "workspace_admin",
    label: "Workspace administrator",
    description:
      "Controls accounts, workspace policy, recovery operations, inventory, and simulation.",
    scope: "global",
    capabilities: [...CAPABILITIES],
  },
  recovery_operator: {
    id: "recovery_operator",
    label: "Recovery operator",
    description:
      "Works assigned recovery cases and store inventory; an empty assignment grants no records.",
    scope: "assigned",
    capabilities: operational.filter(
      (capability) => capability !== "create_cases",
    ),
  },
  auditor: {
    id: "auditor",
    label: "Read-only auditor",
    description:
      "Reviews recovery, inventory, activity, and exports without changing records.",
    scope: "global",
    capabilities: [
      "view_dashboard",
      "view_cases",
      "export_packets",
      "view_inventory",
      "view_activity",
    ],
  },
};

export const roleList = () => AUTH_ROLES.map((role) => ROLE_DEFINITIONS[role]);

export const hasCapability = (user: AuthUser, capability: Capability) =>
  user.capabilities.includes(capability);

export const canAccessCase = (user: AuthUser, caseId: string) =>
  ROLE_DEFINITIONS[user.role].scope === "global" ||
  user.scopes.caseIds.includes(caseId);

export const canAccessStore = (user: AuthUser, storeId: string) =>
  ROLE_DEFINITIONS[user.role].scope === "global" ||
  user.scopes.storeIds.includes(storeId);

export interface SecurityAuditEntry {
  id: string;
  actorId: string | null;
  actorLabel: string;
  targetId: string | null;
  action: string;
  detail: string;
  ip: string;
  createdAt: string;
}

export interface PageResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  pages: number;
}
