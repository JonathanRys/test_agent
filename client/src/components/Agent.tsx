import { SubmitEvent, useEffect, useLayoutEffect, useState } from "react";

type Message = {
  role: "user" | "assistant";
  content: string;
};

type MemoryType = "short-term" | "long-term";

function generateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function getSessionIdFromUrl(): string {
  const params = new URLSearchParams(window.location.search);
  const sessionId = params.get("session");

  if (sessionId) {
    return sessionId;
  }

  // Generate new UUID if no session ID in URL
  const newSessionId = generateUUID();
  setSessionIdInUrl(newSessionId);
  return newSessionId;
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

export default function Agent() {
  const [sessionId, setSessionId] = useState<string>(() =>
    getSessionIdFromUrl(),
  );
  const [prompt, setPrompt] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [memoryType, setMemoryType] = useState<MemoryType>("short-term");
  const [togglingMemory, setTogglingMemory] = useState(false);
  const [isLoadingSession, setIsLoadingSession] = useState(true);
  const [model, setModel] = useState<string>("loading...");

  // Load session data on mount or when sessionId changes
  useEffect(() => {
    async function loadSession() {
      setIsLoadingSession(true);
      try {
        const response = await fetch(`/api/sessions/${sessionId}`);
        const data = await response.json();

        if (data.ok) {
          // Load messages from database
          const loadedMessages: Message[] = data.messages || [];

          // Add initial greeting if no messages
          if (loadedMessages.length === 0) {
            loadedMessages.push({
              role: "assistant",
              content:
                "Ask me anything and I will respond through the local agent endpoint.",
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
              "Ask me anything and I will respond through the local agent endpoint.",
          },
        ]);
      } finally {
        scrollToBottom();
        setIsLoadingSession(false);
      }
    }

    loadSession();
  }, [sessionId]);

  useLayoutEffect(scrollToBottom, [messages]);

  async function handleToggleMemory() {
    setTogglingMemory(true);
    try {
      const response = await fetch(`/api/sessions/${sessionId}/toggle-memory`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = await response.json();
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
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: trimmedPrompt, sessionId }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Request failed");
      }

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
          content:
            error instanceof Error ? error.message : "Something went wrong.",
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
        <span className="status">Model: {model}</span>
      </header>
      <div className="meta-row">
        <button
          className="meta-pill memory-toggle"
          onClick={handleToggleMemory}
          disabled={togglingMemory}
          title="Click to toggle between short-term and long-term memory"
        >
          Memory: {memoryType} {togglingMemory ? "..." : ""}
        </button>
        <span className="meta-pill">Tools: chat + healthcheck</span>
        <span
          className="meta-pill"
          style={{ fontSize: "0.65rem", opacity: 0.7 }}
        >
          Session: {sessionId}
        </span>
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
        <button type="submit" disabled={loading || !prompt.trim()}>
          {loading ? "Thinking..." : "Send"}
        </button>
      </form>
    </section>
  );
}
