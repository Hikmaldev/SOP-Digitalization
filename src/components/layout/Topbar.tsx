import { useLocation } from 'react-router';
import { useAuth } from '../../context/auth-context';
import { initialsOf, ROLE_LABEL } from '../../lib/display';
import { Avatar } from '../Avatar';
import { Icon } from '../Icon';

function crumbsFor(pathname: string): string[] {
  if (pathname === '/') return ['Workspace', 'Overview'];
  if (pathname === '/search') return ['Workspace', 'SOP library'];
  if (pathname.startsWith('/sops/new')) return ['Workspace', 'New SOP'];
  if (pathname.includes('/diagram')) return ['New SOP', 'Diagram editor'];
  if (pathname.includes('/edit')) return ['SOP library', 'Edit SOP'];
  if (pathname.startsWith('/sops/')) return ['SOP library', 'SOP detail'];
  if (pathname === '/approvals') return ['Workspace', 'Approval queue'];
  if (pathname === '/history') return ['Workspace', 'Version history'];
  if (pathname === '/departments') return ['Manage', 'Departments'];
  if (pathname === '/people') return ['Manage', 'People & roles'];
  return ['Workspace', 'Overview'];
}

export function Topbar() {
  const { pathname } = useLocation();
  const { user, logout } = useAuth();
  const crumbs = crumbsFor(pathname);

  return (
    <header className="topbar">
      <div className="breadcrumb">
        {crumbs.map((crumb, index) => {
          const isLast = index === crumbs.length - 1;
          return (
            <span key={crumb}>
              {index > 0 && <b> / </b>}
              {isLast ? <strong>{crumb}</strong> : crumb}
            </span>
          );
        })}
      </div>
      <div className="topbar-actions">
        <button className="icon-button" aria-label="Notifications">
          <Icon name="bell" />
          <i aria-hidden="true" />
        </button>
        {user && (
          <div className="top-user">
            <Avatar initials={initialsOf(user.fullName)} color="navy" />
            <div className="top-user-copy">
              <strong>{user.fullName}</strong>
              <span>{ROLE_LABEL[user.role]}</span>
            </div>
          </div>
        )}
        <button className="logout-button" type="button" onClick={logout} title="Sign out">
          Sign out
        </button>
      </div>
    </header>
  );
}
