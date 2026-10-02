import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";
import Markdown from "../client/src/components/Markdown";

describe("Markdown", () => {
  it("renders markdown syntax as real elements instead of raw text", () => {
    const { container } = render(
      <Markdown>
        {"Hike **Mount Washington** tomorrow.\n\n- leave at 5am\n- bring layers"}
      </Markdown>,
    );

    expect(screen.getByText("Mount Washington").tagName).toBe("STRONG");
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(container.textContent).not.toContain("**");
    expect(container.textContent).not.toContain("- leave at 5am");
  });

  it("opens condition-source links safely in a new tab", () => {
    render(
      <Markdown>
        {"[White Mountain trail conditions](https://nettrailconditions.test/nh/)"}
      </Markdown>,
    );

    const link = screen.getByRole("link", {
      name: "White Mountain trail conditions",
    });
    expect(link).toHaveAttribute(
      "href",
      "https://nettrailconditions.test/nh/",
    );
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("renders mountain-card links as in-app navigation", () => {
    render(
      <MemoryRouter>
        <Markdown>{"[Mount Monadnock](/mountain/42)"}</Markdown>
      </MemoryRouter>,
    );

    const link = screen.getByRole("link", { name: "Mount Monadnock" });
    expect(link).toHaveAttribute("href", "/mountain/42");
    expect(link).not.toHaveAttribute("target", "_blank");
  });

  it("escapes raw HTML from model output instead of rendering it", () => {
    render(<Markdown>{"<img src=x onerror=\"alert(1)\"> done"}</Markdown>);

    // No rehype-raw: the tag must not become a live element (XSS guard).
    expect(document.querySelector("img")).toBeNull();
  });

  it("renders GitHub-flavored tables", () => {
    render(
      <Markdown>
        {"| Peak | Miles |\n| --- | --- |\n| Lafayette | 4.5 |"}
      </Markdown>,
    );

    expect(screen.getByRole("columnheader", { name: "Peak" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "4.5" })).toBeInTheDocument();
  });
});