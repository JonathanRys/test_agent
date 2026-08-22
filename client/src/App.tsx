import { useState } from "react";
import Nav from "./components/Nav";
import Agent from "./components/Agent";
import Lists from "./components/Lists";

export function App() {
  const [mode, setMode] = useState<"agent" | "list">("agent");

  return (
    <main className="app-shell">
      <Nav mode={mode} setMode={setMode} />
      {mode === "agent" && <Agent />}
      {mode === "list" && <Lists />}
    </main>
  );
}
