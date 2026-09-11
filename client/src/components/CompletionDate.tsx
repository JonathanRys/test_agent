import { SubmitEvent, MouseEvent, useState } from "react";
import { FaPen, FaTrash } from "react-icons/fa6";
import MarkComplete, {
  formatCompletedDate,
  completionDateToInputValue,
} from "./MarkComplete";
import { useAuth } from "../auth/AuthContext";
import DatePickerField from "./DatePickerField";
import SeasonPicker from "./SeasonPicker";

export interface CompletionDateProps {
  adventureId: number;
  mountainId?: number;
  trailId?: number;
  name: string;
  completedAt: string;
  editing: boolean;
  season?: string;
  setEditing: (editing: boolean) => void;
  onComplete?: () => void;
}

const CompletionDate = (props: CompletionDateProps) => {
  const {
    adventureId,
    mountainId,
    trailId,
    name,
    completedAt,
    editing,
    season,
    setEditing,
    onComplete,
  } = props;
  const { apiFetch } = useAuth();
  const [activityDate, setActivityDate] = useState(
    completionDateToInputValue(completedAt),
  );
  const [selectedSeason, setSelectedSeason] = useState<string | undefined>(season);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: SubmitEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setSaving(true);
    setError(null);

    try {
      const response = await apiFetch(`/api/adventure/${adventureId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          activityDate,
          season: selectedSeason,
          activityId: 7, // TODO: add activity dropdown
          mountainId: mountainId ? mountainId : undefined,
          trailId: trailId ? trailId : undefined,
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
      const response = await apiFetch(`/api/adventure/${adventureId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mountainId: mountainId ? mountainId : undefined,
          trailId: trailId ? trailId : undefined,
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
        <DatePickerField
          label="Date"
          value={activityDate}
          onChange={setActivityDate}
          required
          className="mark-complete-date"
          floatingLabel
        />{" "}
        <SeasonPicker
          activityDate={activityDate}
          value={selectedSeason}
          onChange={setSelectedSeason}
        />{" "}
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
      <div>
        <p
          className="completion-date"
          onClick={(event) => event.stopPropagation()}
        >
          <span className={season}>
            {formatCompletedDate(completedAt)}&nbsp;{" "}
            <FaPen
              className="edit-icon"
              onClick={(event) => {
                event.stopPropagation();
                setEditing(true);
              }}
              title="Edit"
            />
          </span>
        </p>
      </div>
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
