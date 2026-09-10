import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import type { ListProps } from "./List";
import ListItems from "./ListItems";

export default function ListPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { apiFetch, user } = useAuth();
  const [list, setList] = useState<ListProps | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    apiFetch(`/api/list/${id}`)
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Request failed");
        return data as ListProps;
      })
      .then((data) => {
        if (!cancelled) setList(data);
      })
      .catch((requestError: unknown) => {
        if (!cancelled) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Request failed",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id, user?.id]);

  if (loading) return <p className="centered">Loading...</p>;
  if (error) return <p className="centered">{error}</p>;
  if (!list) return null;

  return (
    <ListItems
      {...list}
      completions={list.completions ?? {}}
      back={() => navigate(-1)}
    />
  );
}
