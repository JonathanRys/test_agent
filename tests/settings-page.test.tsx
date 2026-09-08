import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { AuthProvider } from "../client/src/auth/AuthContext";
import Settings from "../client/src/components/Settings";
import { fetchMock } from "./setup";

describe("Settings", () => {
  it("notifies after saving and returns to the previous page", async () => {
    sessionStorage.setItem("hiking-agent-refresh-token", "refresh-token");
    fetchMock.mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.endsWith("/api/auth/refresh")) {
        return new Response(JSON.stringify({ error: "Expired" }), {
          status: 401,
        });
      }
      if (url.endsWith("/api/me/preferences") && init?.method === "PATCH") {
        return new Response(JSON.stringify({ ok: true }));
      }
      if (url.endsWith("/api/me/preferences")) {
        return new Response(
          JSON.stringify({
            ok: true,
            preferences: {
              fitnessLevel: null,
              homeLocation: "",
              units: "imperial",
              interests: [],
              publicProfile: false,
              publicRatings: true,
            },
            birthdate: null,
          }),
        );
      }
      if (url.endsWith("/api/auth/me")) {
        return new Response(
          JSON.stringify({ ok: true, user: { birthdate: null } }),
        );
      }
      return new Response(JSON.stringify({ error: "Not mocked" }), {
        status: 404,
      });
    });

    render(
      <LocalizationProvider dateAdapter={AdapterDayjs}>
        <MemoryRouter
          initialEntries={["/account", "/settings"]}
          initialIndex={1}
        >
          <AuthProvider>
            <Routes>
              <Route path="/settings" element={<Settings />} />
              <Route path="/account" element={<p>Account page</p>} />
            </Routes>
          </AuthProvider>
        </MemoryRouter>
      </LocalizationProvider>,
    );

    await screen.findByText("Preferences");
    fireEvent.submit(screen.getByRole("button", { name: "Save preferences" }));
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Preferences saved",
    );

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 950));
    });
    expect(screen.getByText("Account page")).toBeInTheDocument();
  });
});
