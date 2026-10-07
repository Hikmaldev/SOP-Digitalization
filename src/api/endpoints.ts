import { apiFetch } from './client';
import type {
  AdminUser,
  ApiUser,
  ApprovalDecision,
  CreatedSopResponse,
  DecidedApprovalItem,
  DecisionResponse,
  Department,
  HistoryItem,
  LoginResponse,
  PendingApprovalItem,
  SearchResult,
  Sop,
  SopDetailResponse,
  SopListItem,
  SopVersion,
  UserRole,
  VersionStatus,
} from '../types';

/** Build a query string, dropping empty/false values (server defaults win). */
function qs(params: Record<string, string | number | boolean | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === '' || value === false) continue;
    search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : '';
}

/* --------------------------------- auth --------------------------------- */

export function login(email: string, password: string): Promise<LoginResponse> {
  return apiFetch('/api/auth/login', { method: 'POST', body: { email, password } });
}

export function me(): Promise<ApiUser> {
  return apiFetch('/api/auth/me');
}

/* ----------------------------- reference data ---------------------------- */

export function listDepartments(): Promise<Department[]> {
  return apiFetch('/api/departments');
}

/* ---------------------------------- users --------------------------------- */

/** Admin-only: every user with its resolved department (FR-AUTH-03). */
export function listUsers(): Promise<AdminUser[]> {
  return apiFetch('/api/users');
}

export interface UpdateUserInput {
  role?: UserRole;
  departmentId?: string;
}

/** Admin-only: reassign a user's role and/or department. */
export function updateUser(userId: string, input: UpdateUserInput): Promise<AdminUser> {
  return apiFetch(`/api/users/${userId}`, { method: 'PATCH', body: input });
}

/* ---------------------------------- SOPs --------------------------------- */

export interface ListSopsParams {
  departmentId?: string;
  includeDrafts?: boolean;
  limit?: number;
  offset?: number;
}

export function listSops(params: ListSopsParams = {}): Promise<SopListItem[]> {
  return apiFetch(
    `/api/sops${qs({
      department: params.departmentId,
      includeDrafts: params.includeDrafts ?? false,
      limit: params.limit ?? 100,
      offset: params.offset ?? 0,
    })}`,
  );
}

export function sopDetail(sopId: string): Promise<SopDetailResponse> {
  return apiFetch(`/api/sops/${sopId}`);
}

export interface CreateSopInput {
  title: string;
  departmentId: string;
  bodyContent?: string | null;
  diagramData?: unknown;
  annotationText?: string | null;
  changeSummary?: string;
}

export function createSop(input: CreateSopInput): Promise<CreatedSopResponse> {
  return apiFetch('/api/sops', { method: 'POST', body: input });
}

export function updateSop(
  sopId: string,
  input: { title?: string; departmentId?: string },
): Promise<Sop> {
  return apiFetch(`/api/sops/${sopId}`, { method: 'PATCH', body: input });
}

/* -------------------------------- versions ------------------------------- */

export function createDraftVersion(
  sopId: string,
  input: { changeSummary: string; sourceVersionId?: string },
): Promise<SopVersion> {
  return apiFetch(`/api/sops/${sopId}/versions`, { method: 'POST', body: input });
}

export interface UpdateVersionInput {
  bodyContent?: string;
  diagramData?: unknown;
  diagramFileUrl?: string;
  annotationText?: string;
  changeSummary?: string;
}

export function updateVersion(
  sopId: string,
  versionId: string,
  input: UpdateVersionInput,
): Promise<SopVersion> {
  return apiFetch(`/api/sops/${sopId}/versions/${versionId}`, { method: 'PATCH', body: input });
}

export function submitVersion(sopId: string, versionId: string): Promise<SopVersion> {
  return apiFetch(`/api/sops/${sopId}/versions/${versionId}/submit`, { method: 'POST' });
}

/* ------------------------------- approvals ------------------------------- */

export function pendingApprovals(): Promise<PendingApprovalItem[]> {
  return apiFetch('/api/approvals');
}

export function decidedApprovals(limit = 20): Promise<DecidedApprovalItem[]> {
  return apiFetch(`/api/approvals/decided${qs({ limit })}`);
}

export function decideOnVersion(
  versionId: string,
  input: { decision: ApprovalDecision; comment?: string },
): Promise<DecisionResponse> {
  return apiFetch(`/api/approvals/${versionId}/decision`, { method: 'POST', body: input });
}

/* --------------------------------- search -------------------------------- */

export interface SearchSopsParams {
  q?: string;
  departmentId?: string;
  includeDrafts?: boolean;
  limit?: number;
  offset?: number;
}

export function searchSops(params: SearchSopsParams = {}): Promise<SearchResult[]> {
  return apiFetch(
    `/api/search${qs({
      q: params.q,
      department: params.departmentId,
      includeDrafts: params.includeDrafts ?? false,
      limit: params.limit ?? 20,
      offset: params.offset ?? 0,
    })}`,
  );
}

/* --------------------------------- history ------------------------------- */

export interface HistoryParams {
  q?: string;
  status?: VersionStatus;
  departmentId?: string;
  limit?: number;
  offset?: number;
}

export function listHistory(params: HistoryParams = {}): Promise<HistoryItem[]> {
  return apiFetch(
    `/api/history${qs({
      q: params.q,
      status: params.status,
      department: params.departmentId,
      limit: params.limit ?? 50,
      offset: params.offset ?? 0,
    })}`,
  );
}
