import type { Actor } from '../types';

/**
 * Pure permission helpers implementing the role/access matrix from PRD §6.
 * Kept free of IO so they can be unit tested directly.
 *
 * Notes on interpretation:
 * - `admin` is treated as a superuser (PRD only lists admin for user management).
 * - "Edit own draft" for author/approver means drafts of SOPs in their own
 *   department (assumption: one SOP belongs to exactly one department).
 */

export interface SopScope {
  departmentId: string;
  createdBy: string;
}

export function isAdmin(actor: Actor): boolean {
  return actor.role === 'admin';
}

export function canCreateSop(actor: Actor): boolean {
  return actor.role === 'author' || actor.role === 'approver' || isAdmin(actor);
}

export function canEditSop(actor: Actor, sop: SopScope): boolean {
  if (isAdmin(actor)) return true;
  if (actor.role !== 'author' && actor.role !== 'approver') return false;
  return actor.departmentId === sop.departmentId;
}

export function canApproveSop(actor: Actor, sop: SopScope): boolean {
  if (isAdmin(actor)) return true;
  if (actor.role !== 'approver') return false;
  return actor.departmentId === sop.departmentId;
}

/** Authors and approvers may optionally include their drafts in search. */
export function canViewDrafts(actor: Actor): boolean {
  return actor.role !== 'viewer';
}

export function canManageUsers(actor: Actor): boolean {
  return isAdmin(actor);
}
