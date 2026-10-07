import { useMemo, useState } from 'react';
import { listUsers, updateUser } from '../api/endpoints';
import { useApi } from '../api/hooks';
import { Avatar } from '../components/Avatar';
import { ErrorPanel, LoadingPanel } from '../components/StatePanels';
import { useAuth } from '../context/auth-context';
import { useWorkspace } from '../context/workspace-context';
import { colorForUser, formatDate, initialsOf, ROLE_LABEL } from '../lib/display';
import type { AdminUser, UserRole } from '../types';

const ROLES: UserRole[] = ['author', 'approver', 'viewer', 'admin'];

interface UserDraft {
  role: UserRole;
  departmentId: string;
}

/** The current user's own row is locked so an admin can't lock themselves out. */
function draftOf(user: AdminUser): UserDraft {
  return { role: user.role, departmentId: user.departmentId ?? '' };
}

/**
 * Admin user directory (FR-AUTH-03): assign roles and departments per person.
 * Every change is applied with PATCH /api/users/:id and the row refreshes from
 * the server, so the list always mirrors the database.
 */
export function PeoplePage() {
  const { user: currentUser } = useAuth();
  const { departments } = useWorkspace();
  const usersState = useApi(() => listUsers(), []);

  const [drafts, setDrafts] = useState<Record<string, UserDraft>>({});
  const [saving, setSaving] = useState<Set<string>>(new Set());
  const [justSaved, setJustSaved] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const users: AdminUser[] = usersState.data ?? [];

  const counts = useMemo(() => {
    const list = usersState.data ?? [];
    const byRole = (role: UserRole) => list.filter((item) => item.role === role).length;
    return {
      total: list.length,
      authors: byRole('author'),
      approvers: byRole('approver'),
      viewers: byRole('viewer'),
      admins: byRole('admin'),
    };
  }, [usersState.data]);

  function setField(user: AdminUser, field: 'role' | 'departmentId', value: string) {
    setDrafts((prev) => {
      const base = prev[user.id] ?? draftOf(user);
      return { ...prev, [user.id]: { ...base, [field]: value } };
    });
  }

  function hasChanges(user: AdminUser): boolean {
    const draft = drafts[user.id];
    if (!draft) return false;
    const departmentId = draft.departmentId || null;
    return draft.role !== user.role || departmentId !== user.departmentId;
  }

  async function handleSave(user: AdminUser) {
    const draft = drafts[user.id];
    if (!draft || hasChanges(user) === false) return;

    setSaving((prev) => new Set(prev).add(user.id));
    setSaveError(null);
    try {
      await updateUser(user.id, {
        role: draft.role,
        ...(draft.departmentId ? { departmentId: draft.departmentId } : {}),
      });
      usersState.reload();
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[user.id];
        return next;
      });
      setJustSaved(user.id);
      window.setTimeout(
        () => setJustSaved((prev) => (prev === user.id ? null : prev)),
        2000,
      );
    } catch (caught) {
      setSaveError(caught instanceof Error ? caught.message : 'Failed to save changes');
    } finally {
      setSaving((prev) => {
        const next = new Set(prev);
        next.delete(user.id);
        return next;
      });
    }
  }

  const isBusy = usersState.status === 'loading' && users.length === 0;

  return (
    <div className="page-wrap">
      <div className="screen-title">
        <div>
          <p className="eyebrow">ADMIN · ACCESS</p>
          <h1>People &amp; roles</h1>
          <p>Assign each person a role and a department. Changes apply immediately.</p>
        </div>
        <span className="admin-note" style={{ margin: 0 }}>
          Roles: author · approver · viewer · admin
        </span>
      </div>

      {usersState.status === 'error' ? (
        <ErrorPanel message={usersState.error ?? 'Failed to load users'} onRetry={usersState.reload} />
      ) : isBusy ? (
        <LoadingPanel label="Loading people…" />
      ) : (
        <div className="admin-card">
          <div className="results-meta" style={{ marginTop: 0 }}>
            <span>
              <strong>{counts.total}</strong> people — {counts.authors} authors · {counts.approvers}{' '}
              approvers · {counts.viewers} viewers · {counts.admins} admins
            </span>
            <span className="sort-button">Name A–Z ▾</span>
          </div>

          {saveError && <p className="hint-inline" style={{ margin: '6px 0 12px' }}>{saveError}</p>}

          <table className="admin-table">
            <thead>
              <tr>
                <th>Person</th>
                <th>Role</th>
                <th>Department</th>
                <th>Member since</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {users.map((row) => {
                const isSelf = currentUser?.id === row.id;
                const draft = drafts[row.id] ?? draftOf(row);
                const changed = hasChanges(row);
                const isSaving = saving.has(row.id);
                return (
                  <tr key={row.id}>
                    <td>
                      <div className="user-cell">
                        <Avatar initials={initialsOf(row.fullName)} color={colorForUser(row.id)} />
                        <div>
                          <strong>
                            {row.fullName}
                            {isSelf && <span className="you-chip">You</span>}
                          </strong>
                          <small>{row.email}</small>
                        </div>
                      </div>
                    </td>
                    <td>
                      <select
                        className="cell-select role-select"
                        value={draft.role}
                        disabled={isSelf || isSaving}
                        onChange={(event) => setField(row, 'role', event.target.value as UserRole)}
                        aria-label={`Role for ${row.fullName}`}
                      >
                        {ROLES.map((role) => (
                          <option key={role} value={role}>
                            {ROLE_LABEL[role]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <select
                        className="cell-select dept-select"
                        value={draft.departmentId}
                        disabled={isSelf || isSaving}
                        onChange={(event) => setField(row, 'departmentId', event.target.value)}
                        aria-label={`Department for ${row.fullName}`}
                      >
                        {row.departmentId === null && (
                          <option value="">Unassigned</option>
                        )}
                        {departments.map((department) => (
                          <option key={department.id} value={department.id}>
                            {department.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>{formatDate(row.createdAt)}</td>
                    <td className="user-action">
                      {isSelf ? (
                        <span className="you-note">Locked (your account)</span>
                      ) : isSaving ? (
                        <span className="saved-tick">Saving…</span>
                      ) : justSaved === row.id ? (
                        <span className="saved-tick">Saved ✓</span>
                      ) : (
                        <button
                          className="mini-button primary"
                          type="button"
                          disabled={!changed}
                          onClick={() => handleSave(row)}
                        >
                          Save
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {users.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '32px 12px' }}>
                    No users found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <div className="admin-facts" style={{ marginTop: 15 }}>
        <section className="detail-card">
          <h3>How roles work</h3>
          <p className="detail-card-p">
            <strong>Authors</strong> create and edit drafts. <strong>Approvers</strong> review and
            publish submitted drafts for their department. <strong>Viewers</strong> read the library.
            <strong> Admins</strong> manage people, departments, and see everything.
          </p>
        </section>
        <section className="detail-card">
          <h3>What changes immediately</h3>
          <p className="detail-card-p">
            A saved role or department takes effect on the next page load: sidebar access, approval
            queue visibility, and per-department draft scoping all follow the stored value.
          </p>
        </section>
      </div>
    </div>
  );
}