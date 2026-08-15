import React, { FormEvent, useState } from "react";

type Message = {
  role: "user" | "assistant";
  content: string;
};

const sessionId = "demo-session";

export function App() {
  const [prompt, setPrompt] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Ask me anything and I will respond through the local agent endpoint.",
    },
  ]);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
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

  return React.createElement(
    "main",
    { className: "app-shell" },
    React.createElement(
      "section",
      { className: "panel" },
      React.createElement(
        "header",
        { className: "header" },
        React.createElement(
          "div",
          null,
          React.createElement("p", { className: "eyebrow" }, "12-Factor Agent"),
          React.createElement("h1", null, "Test Agent"),
        ),
        React.createElement(
          "span",
          { className: "status" },
          "Model: poolside/laguna-s-2.1:free",
        ),
      ),
      React.createElement(
        "div",
        { className: "meta-row" },
        React.createElement(
          "span",
          { className: "meta-pill" },
          "Memory: short term",
        ),
        React.createElement(
          "span",
          { className: "meta-pill" },
          "Tools: chat + healthcheck",
        ),
      ),
      React.createElement(
        "div",
        { className: "chat-window", "aria-live": "polite" },
        ...messages.map((message, index) =>
          React.createElement(
            "div",
            {
              key: `${message.role}-${index}`,
              className: `bubble ${message.role}`,
            },
            message.content,
          ),
        ),
      ),
      React.createElement(
        "form",
        { onSubmit: handleSubmit, className: "composer" },
        React.createElement("textarea", {
          value: prompt,
          onChange: (event: React.ChangeEvent<HTMLTextAreaElement>) =>
            setPrompt(event.target.value),
          rows: 4,
          placeholder: "Type a message for the agent...",
          "aria-label": "Prompt",
        }),
        React.createElement(
          "button",
          { type: "submit", disabled: loading || !prompt.trim() },
          loading ? "Thinking..." : "Send",
        ),
      ),
    ),
  );
}
