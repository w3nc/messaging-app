import { Navigate, Route, Routes } from 'react-router-dom';
import AuthPage from './pages/AuthPage.jsx';
import ChatPage from './pages/ChatPage.jsx';
import ProfilePage from './pages/ProfilePage.jsx';
import { RedirectIfSignedIn, RequireUser } from './routes.jsx';

export default function App() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <RedirectIfSignedIn>
            <AuthPage mode="login" />
          </RedirectIfSignedIn>
        }
      />
      <Route
        path="/signup"
        element={
          <RedirectIfSignedIn>
            <AuthPage mode="signup" />
          </RedirectIfSignedIn>
        }
      />
      <Route
        path="/chat"
        element={
          <RequireUser>
            <ChatPage />
          </RequireUser>
        }
      />
      <Route
        path="/chat/:conversationId"
        element={
          <RequireUser>
            <ChatPage />
          </RequireUser>
        }
      />
      <Route
        path="/profile"
        element={
          <RequireUser>
            <ProfilePage />
          </RequireUser>
        }
      />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
