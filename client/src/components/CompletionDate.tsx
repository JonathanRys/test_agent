import { SubmitEvent, MouseEvent, useState } from "react";
import { FaPen, FaTrash } from "react-icons/fa6";
import MarkComplete, {
  formatCompletedDate,
  completionDateToInputValue,
} from "./MarkComplete";

interface CompletionDateProps {
  adventureId: number;
  mountainId?: number;
  trailId?: number;
  name: string;
  completedAt: string;
  editing: boolean;
  setEditing: (editing: boolean) => void;
  onComplete?: () => void;
}
export function earliestCompletedId(
  completions?: Array<{ id: number; completedAt: string }>,
): number | null {
  if (!completions?.length) {
    return null;
  }

  return [...completions]
    .map((completion) => completion)
    .sort(
      (a, b) =>
        new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime(),
    )[0].id;
}

const CompletionDate = (props: CompletionDateProps) => {
  const {
    adventureId,
    mountainId,
    trailId,
    name,
    completedAt,
    editing,
    setEditing,
    onComplete,
  } = props;
  const [activityDate, setActivityDate] = useState(
    completionDateToInputValue(completedAt),
  );
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: SubmitEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/adventure/${adventureId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          activityDate,
          mountainId: mountainId ? mountainId : undefined,
          trailIds: trailId ? trailId : undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Request failed");
      }

      onComplete && onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setSaving(false);
      setEditing(false);
    }
  };

  const deleteAdventure = async (event: MouseEvent<SVGElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/adventure/${adventureId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mountainId: mountainId ? mountainId : undefined,
          trailIds: trailId ? trailId : undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Request failed");
      }

      onComplete && onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setSaving(false);
      setEditing(false);
    }
  };

  if (editing) {
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
            onChange={(event) => {
              if (event.target.value !== completedAt) {
                setActivityDate(event.target.value);
              }
            }}
            required
          />
        </label>{" "}
        <button type="submit" disabled={saving}>
          {saving ? "Saving..." : "Update"}
        </button>{" "}
        <FaTrash
          title="Delete"
          className="delete-icon"
          onClick={deleteAdventure}
        />
        {error && <p className="mark-complete-error">{error}</p>}
      </form>
    );
  }

  if (completedAt) {
    return (
      <p className="completion-date">
        First Hiked: {formatCompletedDate(completedAt)} &nbsp;{" "}
        <FaPen
          className="edit-icon"
          onClick={(event) => {
            event.stopPropagation();
            setEditing(true);
          }}
          title="Edit"
        />
      </p>
    );
  }

  return (
    onComplete && (
      <MarkComplete
        name={name}
        mountainId={mountainId}
        onComplete={onComplete}
      />
    )
  );
};

export default CompletionDate;
