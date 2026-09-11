import { SubmitEvent, useState } from "react";
import { Completion } from "../types/Completion";
import { useAuth } from "../auth/AuthContext";
import DatePickerField from "./DatePickerField";
import SeasonPicker from "./SeasonPicker";

const HIKING_ACTIVITY_ID = 7;

export const seasonOrder = ["Spring", "Summer", "Autumn", "Winter"];

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

export type MarkCompleteProps = {
  name: string;
  mountainId?: number;
  trailId?: number;
  onComplete: () => void;
};

export default function MarkComplete(props: MarkCompleteProps) {
  const { name, mountainId, trailId, onComplete } = props;
  const { apiFetch } = useAuth();
  const [activityDate, setActivityDate] = useState(todayInputValue);
  const [season, setSeason] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const label = "Mark completed";

  const submit = async (event: SubmitEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setSaving(true);
    setError(null);

    try {
      const response = await apiFetch("/api/adventures", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          activityId: HIKING_ACTIVITY_ID, // TODO: Add activity dropdown
          activityDate,
          season,
          mountainIds: mountainId ? [mountainId] : undefined,
          trailIds: trailId ? [trailId] : undefined,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Request failed");
      }

      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      className="mark-complete"
      onClick={(event) => event.stopPropagation()}
      onSubmit={submit}
    >
      <DatePickerField
        label="Date"
        value={activityDate}
        onChange={setActivityDate}
        required
        className="mark-complete-date"
        floatingLabel
      />
      <SeasonPicker
        activityDate={activityDate}
        value={season}
        onChange={setSeason}
      />
      <button type="submit" disabled={saving}>
        {saving ? "Saving..." : label}
      </button>
      {error && <p className="mark-complete-error">{error}</p>}
    </form>
  );
}

export function earliestCompleted(
  completions?: Array<Completion>,
): Completion | null {
  if (!completions?.length) {
    return null;
  }

  return [...completions].sort(
    (a, b) =>
      new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime(),
  )[0];
}

export function sortCompletionsByDate(completions: Array<Completion>) {
  return [...completions].sort(
    (a, b) =>
      new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime(),
  );
}

export function formatCompletedDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value.slice(0, 10);
  }

  // Use UTC methods to prevent timezone shifting
  return new Date(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
  ).toLocaleDateString();
}

export function completionDateToInputValue(value: string) {
  return new Date(value).toISOString().slice(0, 10);
}
