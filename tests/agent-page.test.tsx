import React from "react";
import { act, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "../client/src/App";

describe("App", () => {
  it("renders public navigation and login", async () => {
    render(React.createElement(App));
    expect(screen.getByRole("link", { name: "Log in" })).toBeInTheDocument();
    expect(screen.getByText("Agent")).toBeInTheDocument();
    expect(screen.getByText("List")).toBeInTheDocument();
    expect(await screen.findByText("Presidential Range")).toBeInTheDocument();
    expect(screen.queryByText(/0 \/ 10 complete/)).not.toBeInTheDocument();
  });

  it("protects the agent route", async () => {
    window.history.pushState({}, "", "/agent");
    render(React.createElement(App));
    await vi.waitFor(() => {
      expect(screen.getByText("Welcome back")).toBeInTheDocument();
    });
  });

  it("loads the public list view from the API", async () => {
    window.history.pushState({}, "", "/");
    await act(async () => {
      render(React.createElement(App));
      await Promise.resolve();
    });
    expect(screen.getByText("Presidential Range")).toBeInTheDocument();
  });
});
