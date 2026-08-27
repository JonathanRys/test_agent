import { SubmitEvent, useState } from "react";

const HIKING_ACTIVITY_ID = 1;

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

type MarkCompleteProps = {
  name: string;
  mountainId?: number;
  trailId?: number;
  onComplete: () => void;
};

export default function MarkComplete(props: MarkCompleteProps) {
  const { name, mountainId, trailId, onComplete } = props;
  const [activityDate, setActivityDate] = useState(todayInputValue);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const label = mountainId ? "Mark hiked" : "Mark completed";

  const submit = async (event: SubmitEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setSaving(true);
    setError(null);

    try {
      const response = await fetch("/api/adventures", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          activityId: HIKING_ACTIVITY_ID,
          activityDate,
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
      <label>
        Date
        <input
          type="date"
          value={activityDate}
          onChange={(event) => setActivityDate(event.target.value)}
          required
        />
      </label>
      <button type="submit" disabled={saving}>
        {saving ? "Saving..." : label}
      </button>
      {error && <p className="mark-complete-error">{error}</p>}
    </form>
  );
}

export function earliestCompletedAt(
  completions?: Array<{ completedAt: string }>,
): string | null {
  if (!completions?.length) {
    return null;
  }

  return [...completions].map((completion) => completion.completedAt).sort()[0];
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
