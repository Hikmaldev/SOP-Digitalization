import { describe, expect, it } from 'vitest';
import {
  canApproveSop,
  canCreateSop,
  canEditSop,
  canManageUsers,
  canViewDrafts,
} from '../src/lib/permissions';
import type { Actor } from '../src/types';

/**
 * Access-control matrix from PRD §6, tested directly on the pure helpers
 * (PRD §13: "verify a viewer cannot reach author or approver actions").
 */

const financeSop = { departmentId: 'dept-fin', createdBy: 'someone-else' };

const authorFinance: Actor = { id: 'u1', role: 'author', departmentId: 'dept-fin' };
const authorOps: Actor = { id: 'u2', role: 'author', departmentId: 'dept-ops' };
const approverFinance: Actor = { id: 'u3', role: 'approver', departmentId: 'dept-fin' };
const approverOps: Actor = { id: 'u4', role: 'approver', departmentId: 'dept-ops' };
const viewer: Actor = { id: 'u5', role: 'viewer', departmentId: 'dept-fin' };
const admin: Actor = { id: 'u6', role: 'admin', departmentId: null };

describe('role-based access (PRD §6)', () => {
  it('create new SOP draft: author and approver yes, viewer no', () => {
    expect(canCreateSop(authorFinance)).toBe(true);
    expect(canCreateSop(approverFinance)).toBe(true);
    expect(canCreateSop(viewer)).toBe(false);
  });

  it('edit drafts: only within the actor’s own department', () => {
    expect(canEditSop(authorFinance, financeSop)).toBe(true);
    expect(canEditSop(authorOps, financeSop)).toBe(false);
    expect(canEditSop(approverFinance, financeSop)).toBe(true);
    expect(canEditSop(viewer, financeSop)).toBe(false);
  });

  it('approve or reject: approver of the same department only', () => {
    expect(canApproveSop(approverFinance, financeSop)).toBe(true);
    expect(canApproveSop(approverOps, financeSop)).toBe(false);
    expect(canApproveSop(authorFinance, financeSop)).toBe(false);
    expect(canApproveSop(viewer, financeSop)).toBe(false);
  });

  it('view drafts in search: viewer never, author/approver yes', () => {
    expect(canViewDrafts(viewer)).toBe(false);
    expect(canViewDrafts(authorFinance)).toBe(true);
    expect(canViewDrafts(approverFinance)).toBe(true);
  });

  it('manage users: admin only', () => {
    expect(canManageUsers(admin)).toBe(true);
    expect(canManageUsers(authorFinance)).toBe(false);
    expect(canManageUsers(approverFinance)).toBe(false);
    expect(canManageUsers(viewer)).toBe(false);
  });

  it('admin is a superuser for SOP actions', () => {
    expect(canCreateSop(admin)).toBe(true);
    expect(canEditSop(admin, financeSop)).toBe(true);
    expect(canApproveSop(admin, financeSop)).toBe(true);
  });
});
