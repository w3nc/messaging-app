import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './auth.jsx';

// Signed-in users only. Guests (Stay logged out) and visitors go to the login page.
export function RequireUser({ children }) {
  const { user, ready } = useAuth();
  const location = useLocation();
  if (!ready) return <div className="boot" role="status">Loading Quickchat...</div>;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return children;
}

// Login and signup pages: if already signed in, go straight to chats.
// Visitors (guests) may still open these pages, so they can create an account or sign in.
export function RedirectIfSignedIn({ children }) {
  const { user, ready } = useAuth();
  if (!ready) return <div className="boot" role="status">Loading Quickchat...</div>;
  if (user && !user.isGuest) return <Navigate to="/chat" replace />;
  return children;
}
