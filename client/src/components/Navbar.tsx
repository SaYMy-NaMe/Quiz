import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/modules/auth/store/auth.store';
import { APP_NAME } from '@/utils/constants';

export function Navbar() {
  const instructor = useAuthStore((s) => s.instructor);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();

  return (
    <header className="navbar">
      <div className="navbar__inner">
        <Link to="/dashboard" className="navbar__brand">
          {APP_NAME}
        </Link>
        <nav className="row">
          {instructor && <span className="muted small">{instructor.name}</span>}
          <button
            className="btn btn--ghost btn--sm"
            onClick={() => {
              void logout().then(() => navigate('/login'));
            }}
          >
            Sign out
          </button>
        </nav>
      </div>
    </header>
  );
}
