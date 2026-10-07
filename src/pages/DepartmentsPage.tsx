import { useMemo } from 'react';
import { Link } from 'react-router';
import { listSops, listUsers } from '../api/endpoints';
import { useApi } from '../api/hooks';
import { Avatar } from '../components/Avatar';
import { ErrorPanel, LoadingPanel } from '../components/StatePanels';
import { useWorkspace } from '../context/workspace-context';
import { colorForUser, initialsOf, TONE_GLYPH, toneFor } from '../lib/display';
import type { AdminUser } from '../types';

interface DepartmentRow {
  departmentId: string;
  name: string;
  members: AdminUser[];
  publishedCount: number;
}

const MAX_AVATARS = 5;

/**
 * Admin directory of departments: team size and published-SOP coverage per
 * department. Departments themselves are reference data (created at company
 * level), so this screen is read-only — people and roles are managed on the
 * People & roles page.
 */
export function DepartmentsPage() {
  const { departments } = useWorkspace();
  const usersState = useApi(() => listUsers(), []);
  const sopsState = useApi(() => listSops({ includeDrafts: true, limit: 100 }), []);

  const users: AdminUser[] = usersState.data ?? [];

  const rows = useMemo<DepartmentRow[]>(() => {
    const userList = usersState.data ?? [];
    const sopList = sopsState.data ?? [];
    return departments.map((department) => ({
      departmentId: department.id,
      name: department.name,
      members: userList.filter((user) => user.departmentId === department.id),
      publishedCount: sopList.filter(
        (item) => item.departmentId === department.id && item.publishedVersion,
      ).length,
    }));
  }, [departments, usersState.data, sopsState.data]);

  const unassigned = users.filter((user) => user.departmentId === null);
  const isLoading = usersState.status === 'loading' && sopsState.status === 'loading';
  const error = usersState.error ?? sopsState.error;

  return (
    <div className="page-wrap">
      <div className="screen-title">
        <div>
          <p className="eyebrow">ADMIN · DIRECTORY</p>
          <h1>Departments</h1>
          <p>Team sizes and published-SOP coverage across the organization.</p>
        </div>
        <Link className="button button-secondary" to="/people">
          Manage people & roles →
        </Link>
      </div>

      {error && rows.length === 0 ? (
        <ErrorPanel message={error} onRetry={usersState.reload} />
      ) : isLoading && rows.length === 0 ? (
        <LoadingPanel label="Loading departments…" />
      ) : (
        <>
          <p className="admin-note">
            Departments are reference data maintained at company level — this screen is read-only.
            Assign roles and departments to people on the People &amp; roles page.
          </p>

          <div className="dept-grid">
            {rows.map((row) => {
              const tone = toneFor(row.departmentId);
              const shown = row.members.slice(0, MAX_AVATARS);
              const hidden = row.members.length - shown.length;
              return (
                <article key={row.departmentId} className="dept-card">
                  <div className="dept-card-top">
                    <div className={`dept-icon doc-${tone}`} aria-hidden="true">
                      <span>{TONE_GLYPH[tone]}</span>
                    </div>
                    <div>
                      <h3>{row.name}</h3>
                      <p>
                        {row.members.length} member{row.members.length === 1 ? '' : 's'} ·{' '}
                        {row.publishedCount} published SOP
                        {row.publishedCount === 1 ? '' : 's'}
                      </p>
                    </div>
                  </div>

                  <div className="dept-stats">
                    <div className="dept-stat">
                      <strong>{row.members.length}</strong>
                      <span>Members</span>
                    </div>
                    <div className="dept-stat">
                      <strong>{row.publishedCount}</strong>
                      <span>Published SOPs</span>
                    </div>
                  </div>

                  <div className="dept-foot">
                    <div className="avatar-stack" aria-label={`${row.members.length} members`}>
                      {shown.length > 0 ? (
                        shown.map((member) => (
                          <Avatar
                            key={member.id}
                            initials={initialsOf(member.fullName)}
                            color={colorForUser(member.id)}
                          />
                        ))
                      ) : (
                        <span className="dept-empty">No members yet</span>
                      )}
                      {hidden > 0 && <span className="avatar-more">+{hidden}</span>}
                    </div>
                    <Link className="text-link" to={`/search?dept=${row.departmentId}`}>
                      Browse SOPs <span>→</span>
                    </Link>
                  </div>
                </article>
              );
            })}

            {unassigned.length > 0 && (
              <article className="dept-card dept-card-muted">
                <div className="dept-card-top">
                  <div className="dept-icon doc-blue" aria-hidden="true">
                    <span>◇</span>
                  </div>
                  <div>
                    <h3>Unassigned</h3>
                    <p>{unassigned.length} user{unassigned.length === 1 ? '' : 's'} without a department</p>
                  </div>
                </div>
                <p className="dept-hint">
                  Assign these people to a department so drafts, approvals, and search filters line up.
                </p>
                <div className="dept-foot">
                  <span className="dept-empty" />
                  <Link className="text-link" to="/people">
                    Assign now <span>→</span>
                  </Link>
                </div>
              </article>
            )}
          </div>
        </>
      )}
    </div>
  );
}