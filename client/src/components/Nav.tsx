import { Link, NavLink } from "react-router-dom";
import { FaUserCircle } from "react-icons/fa";
import { useAuth } from "../auth/AuthContext";

const Nav = () => {
  const { user } = useAuth();
  return (
    <div className="nav">
      <div className="nav-container">
        <Link
          className="account-icon"
          to={user ? "/account" : "/login"}
          aria-label={user ? "Open account" : "Log in"}
          title={user ? "Open account" : "Log in"}
        >
          <FaUserCircle aria-hidden="true" />
        </Link>
        <div className="mode-controls">
          <span className="mode-label">Mode</span>
          <div className="mode-options">
            <NavLink className="option" to="/agent">
              Agent
            </NavLink>
            <NavLink className="option" to="/">
              List
            </NavLink>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Nav;
