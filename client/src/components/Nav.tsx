interface NavProps {
  mode: "agent" | "list";
  setMode: (mode: "agent" | "list") => void;
}

const Nav = (props: NavProps) => {
  const { mode, setMode } = props;
  return (
    <div className="nav">
      <div className="nav-container">
        Mode
        <div>
          <div
            className={mode === "agent" ? "active option" : "option"}
            onClick={() => setMode("agent")}
          >
            Agent
          </div>
          <div
            className={mode === "list" ? "active option" : "option"}
            onClick={() => setMode("list")}
          >
            List
          </div>
        </div>
      </div>
    </div>
  );
};

export default Nav;
