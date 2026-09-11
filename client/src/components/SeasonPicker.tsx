import { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";

type SeasonRange = {
  name: string;
  seasonDates: Array<{ startDate: string; endDate: string }>;
};

export type SeasonPickerProps = {
  activityDate: string;
  value?: string;
  onChange: (season: string) => void;
};

export default function SeasonPicker({
  activityDate,
  value,
  onChange,
}: SeasonPickerProps) {
  const { apiFetch } = useAuth();
  const [borderSeasons, setBorderSeasons] = useState<string[]>([]);

  useEffect(() => {
    if (!activityDate) {
      setBorderSeasons([]);
      return;
    }

    let cancelled = false;
    apiFetch("/api/seasons")
      .then((response) => response.json())
      .then((seasons: SeasonRange[]) => {
        if (cancelled) return;
        const matches = seasons
          .filter((season) =>
            season.seasonDates.some(
              (range) =>
                range.startDate.slice(0, 10) === activityDate ||
                range.endDate.slice(0, 10) === activityDate,
            ),
          )
          .map((season) => season.name);
        setBorderSeasons(matches);
        if (matches.length > 0 && (!value || !matches.includes(value))) {
          onChange(matches[0]);
        }
      })
      .catch(() => setBorderSeasons([]));

    return () => {
      cancelled = true;
    };
  }, [activityDate, apiFetch, onChange, value]);

  if (borderSeasons.length < 2) return null;

  return (
    <label>
      Season
      <select
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value)}
        required
      >
        {borderSeasons.map((season) => (
          <option key={season} value={season}>
            {season}
          </option>
        ))}
      </select>
    </label>
  );
}
