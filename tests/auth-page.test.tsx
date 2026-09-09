import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "../client/src/auth/AuthContext";
import AuthForm from "../client/src/components/AuthForm";
import { fetchMock } from "./setup";

function ExpiredSessionProbe() {
  const { apiFetch } = useAuth();

  return (
    <button type="button" onClick={() => void apiFetch("/api/protected")}>
      Make request
    </button>
  );
}

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

  it("redirects to login when the refresh token has expired", async () => {
    const storage = {
      getItem: vi.fn(() => "expired-token"),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    };
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: storage,
    });
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "No refresh session" }), {
          status: 401,
        }),
      );

    render(
      <MemoryRouter initialEntries={["/settings"]}>
        <AuthProvider>
          <ExpiredSessionProbe />
          <AuthForm mode="login" />
        </AuthProvider>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Make request" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Your session expired. Please log in again.",
    );
    expect(storage.removeItem).toHaveBeenCalledWith(
      "hiking-agent-refresh-token",
    );
  });

  it("redirects automatically when the refresh expiry deadline is reached", async () => {
    vi.useFakeTimers();
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        getItem: vi.fn(() => null),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
      },
    });
    const refreshExpiresAt = new Date(Date.now() + 1000).toISOString();
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          accessToken: "access-token",
          refreshToken: "refresh-token",
          refreshExpiresAt,
          user: {
            id: 1,
            name: "Hiker",
            email: "hiker@example.test",
            emailVerifiedAt: null,
          },
        }),
      ),
    );

    render(
      <MemoryRouter initialEntries={["/settings"]}>
        <AuthProvider>
          <AuthForm mode="login" />
        </AuthProvider>
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "hiker@example.test" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "correct password" },
    });
    await act(async () => {
      fireEvent.submit(screen.getByRole("button", { name: "Log in" }));
    });

    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Your session expired. Please log in again.",
    );
    vi.useRealTimers();
  });
});
