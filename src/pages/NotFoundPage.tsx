import { Link } from 'react-router';

export function NotFoundPage() {
  return (
    <div className="page-wrap">
      <div className="detail-card empty-state" style={{ padding: '60px 30px' }}>
        <p className="eyebrow" style={{ textAlign: 'center' }}>404</p>
        <h1 style={{ textAlign: 'center', margin: 0 }}>Page not found</h1>
        <p className="detail-card-p" style={{ textAlign: 'center', margin: '10px 0 22px' }}>
          The page you're looking for doesn't exist or has moved.
        </p>
        <div style={{ textAlign: 'center' }}>
          <Link className="button button-primary" to="/">
            Back to overview
          </Link>
        </div>
      </div>
    </div>
  );
}