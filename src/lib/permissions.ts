export const ROLE_VALUES = ["ADMIN", "ACCOUNTANT", "ENROLLMENT_OFFICER"] as const;

export type AppRole = (typeof ROLE_VALUES)[number];

export const PRIVILEGE_KEYS = [
  "canEnrollStudents",
  "canViewAggregateFinancials",
  "canCancelConcession",
  "canRevokeConcessionCancellation",
  "canGenerateReports",
  "canAssignRoles",
  "canExportReports",
  "canViewPaymentHistory",
  "canEditStudentProfile",
  "canViewFeeCategory",
] as const;

export type PrivilegeKey = (typeof PRIVILEGE_KEYS)[number];
export type Privileges = Record<PrivilegeKey, boolean>;

export interface PermissionUser {
  role: AppRole;
  privileges?: Partial<Privileges> | null;
}

const allFalse: Privileges = {
  canEnrollStudents: false,
  canViewAggregateFinancials: false,
  canCancelConcession: false,
  canRevokeConcessionCancellation: false,
  canGenerateReports: false,
  canAssignRoles: false,
  canExportReports: false,
  canViewPaymentHistory: false,
  canEditStudentProfile: false,
  canViewFeeCategory: false,
};

export const DEFAULT_PRIVILEGES_BY_ROLE: Record<AppRole, Privileges> = {
  ADMIN: {
    ...allFalse,
    canEnrollStudents: true,
    canViewAggregateFinancials: true,
    canCancelConcession: true,
    canRevokeConcessionCancellation: true,
    canGenerateReports: true,
    canAssignRoles: true,
    canExportReports: true,
    canViewPaymentHistory: true,
    canEditStudentProfile: true,
    canViewFeeCategory: true,
  },
  ACCOUNTANT: {
    ...allFalse,
    canCancelConcession: true,
    canGenerateReports: true,
    canExportReports: true,
    canViewPaymentHistory: true,
    canViewFeeCategory: true,
  },
  ENROLLMENT_OFFICER: {
    ...allFalse,
    canEnrollStudents: true,
    canEditStudentProfile: true,
    canViewFeeCategory: true,
  },
};

export const PRIVILEGES_BY_ROLE: Record<AppRole, PrivilegeKey[]> = {
  ADMIN: [...PRIVILEGE_KEYS],
  ACCOUNTANT: [
    "canEnrollStudents",
    "canViewAggregateFinancials",
    "canCancelConcession",
    "canGenerateReports",
    "canExportReports",
    "canViewPaymentHistory",
  ],
  ENROLLMENT_OFFICER: ["canEnrollStudents", "canEditStudentProfile", "canViewFeeCategory"],
};

export function normalizeRole(role: string | null | undefined): AppRole {
  const value = (role ?? "").toUpperCase().trim();
  if (value === "ADMIN") return "ADMIN";
  if (value === "ACCOUNTANT" || value === "CASHIER") return "ACCOUNTANT";
  if (value === "ENROLLMENT_OFFICER" || value === "ENROLLMENT OFFICER") return "ENROLLMENT_OFFICER";
  return "ACCOUNTANT";
}

export function roleLabel(role: AppRole | string | null | undefined): string {
  if (!role) return "—";
  const normalized = normalizeRole(typeof role === "string" ? role : null);
  if (normalized === "ADMIN") return "Admin";
  if (normalized === "ACCOUNTANT") return "Accountant";
  return "Enrollment Officer";
}

export function defaultPrivilegesForRole(role: AppRole): Privileges {
  return { ...DEFAULT_PRIVILEGES_BY_ROLE[role] };
}

export function sanitizePrivilegesForRole(
  role: AppRole,
  privileges?: Partial<Privileges> | null,
): Privileges {
  const allowed = new Set(PRIVILEGES_BY_ROLE[role]);
  const defaults = defaultPrivilegesForRole(role);
  for (const key of PRIVILEGE_KEYS) {
    if (!allowed.has(key)) {
      defaults[key] = false;
      continue;
    }
    if (typeof privileges?.[key] === "boolean") defaults[key] = Boolean(privileges[key]);
  }
  return defaults;
}

export function hasPermission(
  user: PermissionUser | null | undefined,
  permission: PrivilegeKey,
): boolean {
  if (!user) return false;
  if (user.role === "ADMIN") return true;
  return Boolean(user.privileges?.[permission]);
}

export function hasRole(user: PermissionUser | null | undefined, roles: AppRole[]): boolean {
  if (!user) return false;
  return roles.includes(user.role);
}
