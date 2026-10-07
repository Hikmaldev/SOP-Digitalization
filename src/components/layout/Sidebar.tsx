import { NavLink } from 'react-router';
import { useAuth } from '../../context/auth-context';
import { useWorkspace } from '../../context/workspace-context';
import { initialsOf, ROLE_LABEL } from '../../lib/display';
import { Avatar } from '../Avatar';
import { Icon } from '../Icon';
import type { IconName } from '../Icon';

interface NavEntry {
  to: string;
  label: string;
  icon: IconName;
  end?: boolean;
}

const WORKSPACE_NAV: NavEntry[] = [
  { to: '/', label: 'Overview', icon: 'overview', end: true },
  { to: '/search', label: 'SOP library', icon: 'library' },
  { to: '/approvals', label: 'Approval queue', icon: 'approvals' },
  { to: '/history', label: 'Version history', icon: 'history' },
];

const MANAGE_NAV: NavEntry[] = [
  { to: '/departments', label: 'Departments', icon: 'departments' },
  { to: '/people', label: 'People & roles', icon: 'people' },
];

function navClassName({ isActive }: { isActive: boolean }): string {
  return `nav-item${isActive ? ' active' : ''}`;
}

export function Sidebar() {
  const { user, logout } = useAuth();
  const { approvals } = useWorkspace();
  const pendingCount = approvals.length;

  if (!user) return null;

  return (
    <aside className="sidebar">
      <div className="brand">
        <img
          className="brand-mark"
          src="/brand-mark.svg"
          alt=""
          width="30"
          height="30"
          aria-hidden="true"
        />
        <div>
          <strong>SOPly</strong>
          <small>Process library</small>
        </div>
      </div>

      <nav className="main-nav" aria-label="Main navigation">
        <p className="nav-label">Workspace</p>
        {WORKSPACE_NAV.map((entry) => (
          <NavLink key={entry.to} to={entry.to} end={entry.end} className={navClassName}>
            <Icon name={entry.icon} />
            <span>{entry.label}</span>
            {entry.to === '/approvals' && pendingCount > 0 ? (
              <b className="nav-count alert">{pendingCount}</b>
            ) : null}
          </NavLink>
        ))}

        <p className="nav-label nav-label-spaced">Manage</p>
        {user.role === 'admin' &&
          MANAGE_NAV.map((entry) => (
            <NavLink key={entry.to} to={entry.to} className={navClassName}>
              <Icon name={entry.icon} />
              <span>{entry.label}</span>
            </NavLink>
          ))}
      </nav>

      <div className="sidebar-bottom">
        <div className="help-card">
          <div className="help-icon">?</div>
          <div>
            <strong>Need a hand?</strong>
            <span>Read the quick guide</span>
          </div>
          <span className="arrow">↗</span>
        </div>
        <div className="profile">
          <Avatar initials={initialsOf(user.fullName)} color="navy" />
          <div className="profile-copy">
            <strong>{user.fullName}</strong>
            <span>{ROLE_LABEL[user.role]}</span>
          </div>
          <button className="logout-button" type="button" onClick={logout} title="Sign out">
            Sign out
          </button>
        </div>
      </div>
    </aside>
  );
}
