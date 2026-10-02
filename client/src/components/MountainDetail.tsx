import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import type { Mountain as MountainType } from "../types/Mountain";
import Mountain from "./Mountain";

export default function MountainDetail() {
  const { id } = useParams();
  const { apiFetch, user } = useAuth();
  const [mountain, setMountain] = useState<MountainType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    apiFetch(`/api/mountain/${id}`)
      .then(async (response) => {
        const data = (await response.json()) as MountainType | null;
        if (!response.ok) throw new Error("Unable to load this mountain");
        if (!data) throw new Error("Mountain not found");
        return data;
      })
      .then((data) => {
        if (!cancelled) setMountain(data);
      })
      .catch((requestError: unknown) => {
        if (!cancelled) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Unable to load this mountain",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [apiFetch, id, user?.id]);

  if (loading) return <p className="centered">Loading mountain...</p>;
  if (error) return <p className="centered">{error}</p>;
  if (!mountain) return null;

  return (
    <section className="panel">
      <Mountain {...mountain} index={0} expanded />
    </section>
  );
}