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
import ForgotPassword from "./components/ForgotPassword";
import ResetPassword from "./components/ResetPassword";
import ListPage from "./components/ListPage";
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
  ].includes(location.pathname);
  const isAccountRoute =
    location.pathname === "/account" || location.pathname === "/settings";

  return (
    <main
      className={`app-shell${isAuthRoute ? " auth-shell" : ""}${isAccountRoute ? " account-shell" : ""}`}
    >
      <Nav />
      <Routes>
        <Route path="/" element={<Lists />} />
        <Route path="/list/:id" element={<ListPage />} />
        <Route path="/login" element={<AuthForm mode="login" />} />
        <Route path="/register" element={<AuthForm mode="register" />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
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
