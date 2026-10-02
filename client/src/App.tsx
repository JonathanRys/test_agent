import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext";
import Account from "./components/account/Account";
import AuthForm from "./components/auth/AuthForm";
import Nav from "./components/shared/Nav";
import Agent from "./components/agent/Agent";
import Lists from "./components/lists/Lists";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import Settings from "./components/account/Settings";
import ForgotPassword from "./components/auth/ForgotPassword";
import ResetPassword from "./components/auth/ResetPassword";
import ListPage from "./components/lists/ListPage";
import MountainDetail from "./components/mountains/MountainDetail";
import Admin from "./components/account/Admin";
import VerifyEmail from "./components/auth/VerifyEmail";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";

export function App() {
  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <BrowserRouter>
        <AuthProvider>
          <AppLayout />
        </AuthProvider>
      </BrowserRouter>
    </LocalizationProvider>
  );
}

function AppLayout() {
  const location = useLocation();
  const isAuthRoute = [
    "/login",
    "/register",
    "/forgot-password",
    "/reset-password",
    "/verify-email",
  ].includes(location.pathname);
  const isAccountRoute =
    location.pathname === "/account" || location.pathname === "/settings";

  return (
    <main
      className={`app-shell${isAuthRoute ? " auth-shell" : ""}${isAccountRoute ? " account-shell" : ""}`}
    >
      <Nav />
      <Routes>
        <Route path="/login" element={<AuthForm mode="login" />} />
        <Route path="/register" element={<AuthForm mode="register" />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<Lists />} />
          <Route path="/list/:id" element={<ListPage />} />
          <Route path="/mountain/:id" element={<MountainDetail />} />
          <Route path="/agent" element={<Agent />} />
          <Route path="/account" element={<Account />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/admin" element={<Admin />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </main>
  );
}
