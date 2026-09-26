import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "../client/src/App";

describe("App", () => {
  it("renders public navigation and login", async () => {
    render(React.createElement(App));
    expect(screen.getByRole("link", { name: "Log in" })).toBeInTheDocument();
    expect(screen.getByText("Agent")).toBeInTheDocument();
    expect(screen.getByText("List")).toBeInTheDocument();
    expect(await screen.findByText("Welcome back")).toBeInTheDocument();
    expect(screen.queryByText("Presidential Range")).not.toBeInTheDocument();
  });

  it("protects the agent route", async () => {
    window.history.pushState({}, "", "/agent");
    render(React.createElement(App));
    await vi.waitFor(() => {
      expect(screen.getByText("Welcome back")).toBeInTheDocument();
    });
  });

  it("protects the lists route", async () => {
    window.history.pushState({}, "", "/");
    render(React.createElement(App));
    await vi.waitFor(() => {
      expect(screen.getByText("Welcome back")).toBeInTheDocument();
    });
    expect(screen.queryByText("Presidential Range")).not.toBeInTheDocument();
  });
});
