import { FormEvent, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import DatePickerField from "./DatePickerField";

type Preferences = {
  birthdate: string | null;
  fitnessLevel: "beginner" | "intermediate" | "expert" | null;
  homeLocation: string | null;
  units: "imperial" | "metric";
  interests: string[];
  publicProfile: boolean;
  publicRatings: boolean;
};

const initialPreferences: Preferences = {
  birthdate: null,
  fitnessLevel: null,
  homeLocation: "",
  units: "imperial",
  interests: [],
  publicProfile: false,
  publicRatings: true,
};

type SaveStatus = {
  message: string;
  kind: "success" | "error";
};

export default function Settings() {
  const { apiFetch } = useAuth();
  const navigate = useNavigate();
  const [preferences, setPreferences] = useState(initialPreferences);
  const [status, setStatus] = useState<SaveStatus | null>(null);
  const [saving, setSaving] = useState(false);
  const navigationTimer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (navigationTimer.current !== null) {
        window.clearTimeout(navigationTimer.current);
      }
    };
  }, []);

  useEffect(() => {
    async function load() {
      const preferencesResponse = await apiFetch("/api/me/preferences");
      const preferencesData = await preferencesResponse.json();
      if (preferencesResponse.ok) setPreferences(preferencesData.preferences);
    }
    void load();
  }, []);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus(null);
    setSaving(true);
    try {
      const response = await apiFetch("/api/me/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(preferences),
      });

      if (!response.ok) {
        setStatus({ message: "Unable to save preferences", kind: "error" });
        return;
      }

      setStatus({ message: "Preferences saved", kind: "success" });
      navigationTimer.current = window.setTimeout(() => {
        navigate(-1);
      }, 900);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="panel">
      <p className="eyebrow">Account</p>
      <h1>Preferences</h1>
      <form onSubmit={save} className="composer">
        <DatePickerField
          label="Birthdate"
          value={preferences.birthdate ?? ""}
          onChange={(value) =>
            setPreferences({ ...preferences, birthdate: value || null })
          }
          fullWidth
          className="settings-date"
          floatingLabel
        />
        <label className="floating-field">
          <select
            value={preferences.fitnessLevel ?? ""}
            onChange={(event) =>
              setPreferences({
                ...preferences,
                fitnessLevel: (event.target.value ||
                  null) as Preferences["fitnessLevel"],
              })
            }
          >
            <option value="">Choose later</option>
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="expert">Expert</option>
          </select>
          <span>Fitness level</span>
        </label>
        <label className="floating-field">
          <input
            placeholder=" "
            value={preferences.homeLocation ?? ""}
            onChange={(event) =>
              setPreferences({
                ...preferences,
                homeLocation: event.target.value,
              })
            }
          />
          <span>Home location</span>
        </label>
        <label className="floating-field">
          <select
            value={preferences.units}
            onChange={(event) =>
              setPreferences({
                ...preferences,
                units: event.target.value as Preferences["units"],
              })
            }
          >
            <option value="imperial">Imperial</option>
            <option value="metric">Metric</option>
          </select>
          <span>Units</span>
        </label>
        <label>
          <input
            type="checkbox"
            checked={preferences.publicProfile}
            onChange={(event) =>
              setPreferences({
                ...preferences,
                publicProfile: event.target.checked,
              })
            }
          />
          Public profile
        </label>
        <label>
          <input
            type="checkbox"
            checked={preferences.publicRatings}
            onChange={(event) =>
              setPreferences({
                ...preferences,
                publicRatings: event.target.checked,
              })
            }
          />
          Public ratings
        </label>
        {status && (
          <p className={`preference-notification ${status.kind}`} role="status">
            {status.message}
          </p>
        )}
        <button type="submit" disabled={saving}>
          {saving ? "Saving..." : "Save preferences"}
        </button>
      </form>
    </section>
  );
}
