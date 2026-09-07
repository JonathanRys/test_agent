import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { AuthProvider } from "../client/src/auth/AuthContext";
import AuthForm from "../client/src/components/AuthForm";
import { fetchMock } from "./setup";

describe("AuthForm", () => {
  it("shows the server error when login fails", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "Invalid email or password" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }),
    );

    render(
      <MemoryRouter>
        <AuthProvider>
          <AuthForm mode="login" />
        </AuthProvider>
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "hiker@example.test" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "wrong password" },
    });
    fireEvent.submit(screen.getByRole("button", { name: "Log in" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Invalid email or password",
    );
  });
});
