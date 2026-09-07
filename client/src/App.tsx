import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext";
import Account from "./components/Account";
import AuthForm from "./components/AuthForm";
import Nav from "./components/Nav";
import Agent from "./components/Agent";
import Lists from "./components/Lists";
import ProtectedRoute from "./components/ProtectedRoute";
import Settings from "./components/Settings";

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppLayout />
      </AuthProvider>
    </BrowserRouter>
  );
}

function AppLayout() {
  const location = useLocation();
  const isAuthRoute =
    location.pathname === "/login" || location.pathname === "/register";
  const isAccountRoute =
    location.pathname === "/account" || location.pathname === "/settings";

  return (
    <main
      className={`app-shell${isAuthRoute ? " auth-shell" : ""}${isAccountRoute ? " account-shell" : ""}`}
    >
      <Nav />
      <Routes>
        <Route path="/" element={<Lists />} />
        <Route path="/login" element={<AuthForm mode="login" />} />
        <Route path="/register" element={<AuthForm mode="register" />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/agent" element={<Agent />} />
          <Route path="/account" element={<Account />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </main>
  );
}
