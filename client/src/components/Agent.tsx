import { SubmitEvent, useEffect, useLayoutEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getLastAgentSession,
  setLastAgentSession,
  useAuth,
} from "../auth/AuthContext";
import type { AgentSession, MemoryType, Message } from "../types/Agent";

function generateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function getSessionIdFromUrl(): string | null {
  const params = new URLSearchParams(window.location.search);
  const sessionId = params.get("session");

  return sessionId;
}

function setSessionIdInUrl(id: string): void {
  const params = new URLSearchParams(window.location.search);
  params.set("session", id);
  window.history.replaceState({}, "", `?${params.toString()}`);
}

function scrollToBottom() {
  const element = document.querySelector(".chat-window");
  if (element) {
    element.scroll({
      top: element.scrollHeight,
      behavior: "smooth",
    });
  }
}

async function readAgentResponse(
  response: Response,
): Promise<Record<string, any>> {
  const body = await response.text();
  if (!body.trim()) {
    throw new Error("The agent connection was interrupted. Please try again.");
  }

  try {
    return JSON.parse(body) as Record<string, any>;
  } catch {
    throw new Error(
      "The agent returned an invalid response. Please try again.",
    );
  }
}

async function readAgentStream(
  response: Response,
  onToken: (content: string) => void,
): Promise<Record<string, any>> {
  if (!response.body) {
    throw new Error("The agent connection was interrupted. Please try again.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let content = "";
  let doneData: Record<string, any> | null = null;

  const processEvent = (event: string) => {
    const dataLine = event
      .split("\n")
      .find((line) => line.startsWith("data: "));
    if (!dataLine) return;
    const data = JSON.parse(dataLine.slice(6)) as Record<string, any>;
    if (event.startsWith("event: token")) {
      content += data.token ?? "";
      onToken(content);
    }
    if (event.startsWith("event: done")) doneData = data;
  };

  while (true) {
    const chunk = await reader.read();
    buffer += decoder.decode(chunk.value ?? new Uint8Array(), {
      stream: !chunk.done,
    });
    const events = buffer.split("\n\n");
    buffer = events.pop() ?? "";
    events.forEach(processEvent);
    if (chunk.done) break;
  }
  if (buffer.trim()) processEvent(buffer);

  if (!doneData) {
    throw new Error("The agent connection ended before completing the response.");
  }
  return doneData;
}

function getAgentErrorMessage(error: unknown): string {
  if (
    error instanceof TypeError ||
    (error instanceof Error &&
      /socket hang up|fetch failed/i.test(error.message))
  ) {
    return "The agent connection was interrupted. Please try again.";
  }

  return error instanceof Error ? error.message : "Something went wrong.";
}

export default function Agent() {
  const { apiFetch, user } = useAuth();
  const navigate = useNavigate();
  const [sessionId, setSessionId] = useState<string | null>(() =>
    getSessionIdFromUrl(),
  );
  const [prompt, setPrompt] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [memoryType, setMemoryType] = useState<MemoryType>("short-term");
  const [togglingMemory, setTogglingMemory] = useState(false);
  const [isLoadingSession, setIsLoadingSession] = useState(true);
  const [model, setModel] = useState<string>("loading...");
  const [sessions, setSessions] = useState<AgentSession[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    if (!user || sessionId) return;

    const restoredSessionId = getLastAgentSession(user.id) ?? generateUUID();
    setSessionId(restoredSessionId);
    setSessionIdInUrl(restoredSessionId);
  }, [sessionId, user]);

  useEffect(() => {
    if (user && sessionId) setLastAgentSession(user.id, sessionId);
  }, [sessionId, user]);

  function startNewSession() {
    const newSessionId = generateUUID();
    setSessionId(newSessionId);
    setMessages([]);
    setMemoryType("short-term");
    setModel("loading...");
    navigate(`/agent?session=${newSessionId}`, { replace: true });
  }

  async function loadSessionHistory() {
    try {
      const response = await apiFetch("/api/sessions");
      const data = await readAgentResponse(response);
      if (!response.ok) throw new Error(data.error ?? "Failed to load sessions");
      setSessions(data.sessions ?? []);
    } catch (error) {
      console.error("Failed to load session history:", error);
    }
  }

  function resumeSession(id: string) {
    setShowHistory(false);
    setSessionId(id);
    navigate(`/agent?session=${id}`);
  }

  useEffect(() => {
    if (user) loadSessionHistory();
  }, [user]);

  // Load session data on mount or when sessionId changes
  useEffect(() => {
    async function loadSession() {
      if (!sessionId) return;
      setIsLoadingSession(true);
      try {
        const response = await apiFetch(`/api/sessions/${sessionId}`);
        const data = await readAgentResponse(response);
        if (!response.ok)
          throw new Error(data.error ?? "Failed to load session");

        if (data.ok) {
          // Load messages from database
          const loadedMessages: Message[] = data.messages || [];

          // Add initial greeting if no messages
          if (loadedMessages.length === 0) {
            loadedMessages.push({
              role: "assistant",
              content:
                "Hello, I am your hiking assistant. I can check your hiking completions, provide information about trails and mountains, and help you plan your next adventure. How can I assist you today?",
            });
          }

          setMessages(loadedMessages);
          setMemoryType(data.memoryType ?? "short-term");
          setModel(data.model ?? "unknown");
          setSessionIdInUrl(sessionId);
        }
      } catch (error) {
        console.error("Failed to load session:", error);
        // Start with default greeting on error
        setMessages([
          {
            role: "assistant",
            content:
              "Hello, I am your hiking assistant. I can check your hiking completions, provide information about trails and mountains, and help you plan your next adventure. How can I assist you today?",
          },
        ]);
      } finally {
        scrollToBottom();
        setIsLoadingSession(false);
      }
    }

    loadSession();
  }, [apiFetch, sessionId]);

  useLayoutEffect(scrollToBottom, [messages]);

  async function handleToggleMemory() {
    setTogglingMemory(true);
    try {
      const response = await apiFetch(
        `/api/sessions/${sessionId}/toggle-memory`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        },
      );

      const data = await readAgentResponse(response);
      if (!response.ok) {
        throw new Error(data.error ?? "Failed to toggle memory");
      }

      setMemoryType(data.memoryType);
    } catch (error) {
      console.error("Failed to toggle memory:", error);
    } finally {
      setTogglingMemory(false);
    }
  }

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt || loading) return;

    const nextMessages: Message[] = [
      ...messages,
      { role: "user", content: trimmedPrompt },
    ];
    setMessages(nextMessages);
    setPrompt("");
    setLoading(true);

    try {
      const response = await apiFetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: trimmedPrompt, sessionId }),
      });

      if (!response.ok) {
        const data = await readAgentResponse(response);
        throw new Error(data.error ?? "Request failed");
      }

      const data = await readAgentStream(response, (content) => {
        setMessages([...nextMessages, { role: "assistant", content }]);
      });

      setMessages([
        ...nextMessages,
        { role: "assistant", content: data.message.content },
      ]);

      // Update memory type if it changed
      if (data.memoryType) {
        setMemoryType(data.memoryType);
      }

      // Update model from response
      if (data.model) {
        setModel(data.model);
      }
    } catch (error) {
      setMessages([
        ...nextMessages,
        {
          role: "assistant",
          content: getAgentErrorMessage(error),
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  if (isLoadingSession) {
    return (
      <section className="panel">
        <div style={{ textAlign: "center", padding: "40px" }}>
          <p>Loading session...</p>
        </div>
      </section>
    );
  }

  return (
    <section className="panel">
      <header className="header">
        <div>
          <p className="eyebrow">Hiking Agent</p>
          <h1>Hiking Agent</h1>
        </div>
        <div className="agent-header-actions">
          <button
            type="button"
            className="history-button"
            onClick={() => {
              setShowHistory(!showHistory);
              if (!showHistory) loadSessionHistory();
            }}
          >
            {showHistory ? "Hide history" : "History"}
          </button>
          <span className="status">Model: {model}</span>
        </div>
      </header>
      {showHistory && (
        <div className="session-history" aria-label="Conversation history">
          <h2>Previous conversations</h2>
          {sessions.length === 0 ? (
            <p className="session-empty">No previous conversations yet.</p>
          ) : (
            <div className="session-list">
              {sessions.map((session) => (
                <button
                  type="button"
                  className={`session-item${session.id === sessionId ? " active" : ""}`}
                  key={session.id}
                  onClick={() => resumeSession(session.id)}
                >
                  <strong>{session.preview || "Untitled conversation"}</strong>
                  <span>{new Date(session.updatedAt).toLocaleString()}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      <div className="meta-row">
        <button
          className="meta-pill memory-toggle"
          onClick={handleToggleMemory}
          disabled={togglingMemory}
          title="Click to toggle between short-term and long-term memory"
        >
          Memory: {memoryType} {togglingMemory ? "..." : ""}
        </button>
      </div>
      <div className="chat-window" aria-live="polite">
        {messages.map((message, index) => (
          <div
            key={`${message.role}-${index}`}
            className={`bubble ${message.role}`}
          >
            {message.content}
          </div>
        ))}
      </div>
      <form onSubmit={handleSubmit} className="composer">
        <textarea
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          rows={4}
          placeholder="Type a message for the agent..."
          aria-label="Prompt"
        />
        <div className="agent-controls">
          <button
            type="button"
            className={
              loading || isLoadingSession ? "loading-cursor" : undefined
            }
            disabled={loading || !prompt.trim()}
            onClick={startNewSession}
          >
            New session
          </button>
          <button
            type="submit"
            className={
              loading || isLoadingSession ? "loading-cursor" : undefined
            }
            disabled={loading || !prompt.trim()}
          >
            {loading ? "Thinking..." : "Send"}
          </button>
        </div>
      </form>
    </section>
  );
}
