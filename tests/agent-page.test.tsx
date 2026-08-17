import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "../client/src/App";

describe("App", () => {
  it("renders the app title", async () => {
    render(React.createElement(App));
    expect(screen.getByText("Loading session...")).toBeInTheDocument();
    await vi.waitFor(() => {
      expect(screen.getByText("Test Agent")).toBeInTheDocument();
    });
  });
});
