import { useEffect, useState, type ComponentType } from "react";
import { MdArrowBack } from "react-icons/md";
import Mountain from "./Mountain";
import Trail from "./Trail";
import RockClimbing from "./RockClimbing";
import TrailMaintenance from "./TrailMaintenance";
import { useAuth } from "../auth/AuthContext";
import type { ListDefinition } from "../types/List";

interface ListItemsProps {
  id: number;
  name: string;
  type: "peakbagging" | "trace" | "rockClimbing" | "trailMaintenance";
  totalCount?: number;
  completedCount?: number;
  completions: Record<
    number,
    {
      completedAt: string;
      season: string;
    }
  >;
  back: () => void;
}

const listDefinitions: Record<ListItemsProps["type"], ListDefinition> = {
  peakbagging: {
    endpoint: (id) => `/api/mountainList/${id}`,
    item: Mountain,
    itemKey: "mountain",
    isCompleted: (item) => Boolean(item.Summits?.length),
  },
  trace: {
    endpoint: (id) => `/api/trailList/${id}`,
    item: Trail,
    itemKey: "trail",
    isCompleted: (item) => Boolean(item.TrailCompletions?.length),
  },
  rockClimbing: {
    endpoint: (id) => `/api/rockClimbingList/${id}`,
    item: RockClimbing,
    itemKey: "rockClimbing",
    isCompleted: (item) => Boolean(item.RockClimbingCompletions?.length),
  },
  trailMaintenance: {
    endpoint: (id) => `/api/trailMaintenanceList/${id}`,
    item: TrailMaintenance,
    itemKey: "trailMaintenance",
    isCompleted: (item) => Boolean(item.TrailMaintenanceCompletions?.length),
  },
};

export default function ListItems(props: ListItemsProps) {
  const { user, apiFetch } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const { id, name, type, back, totalCount, completedCount, completions } =
    props;

  const definition = listDefinitions[type];
  const endpoint = definition.endpoint(id);

  useEffect(() => {
    const loadItems = async () => {
      try {
        const response = await apiFetch(endpoint, {
          method: "GET",
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error ?? "Request failed");
        }

        setItems(data);
        setLoading(false);
      } catch (error) {
        console.error("Error fetching lists.", error);
        setLoading(false);
      }
    };
    loadItems();
  }, [id, endpoint]);

  const refreshItems = async () => {
    try {
      const response = await apiFetch(endpoint, {
        method: "GET",
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Request failed");
      }
      setItems(data);
    } catch (error) {
      console.error("Error fetching lists.", error);
    }
  };

  return (
    <>
      <h1 className="centered">
        <MdArrowBack
          className="clickable"
          style={{ color: "rgba(225, 225, 225, 0.3)" }}
          title="Back to lists"
          onClick={back}
        />
        &nbsp;
        {name}
      </h1>
      {user &&
        typeof totalCount === "number" &&
        typeof completedCount === "number" &&
        !loading && (
          <p
            className={`centered list-progress${completedCount > 0 && completedCount === totalCount ? " completed" : ""}`}
          >
            {items.filter(definition.isCompleted).length} /{" "}
            {items.length || totalCount} complete
          </p>
        )}
      <br />
      {loading
        ? "Loading..."
        : items.length
          ? items.map((item, i) => (
              <section
                key={`${definition.itemKey}-${item.id}`}
                className={`panel${
                  definition.isCompleted(item) ? " panel-completed" : ""
                }`}
              >
                <definition.item
                  {...item}
                  index={i + 1}
                  onComplete={user ? refreshItems : undefined}
                  season={completions?.[item.id]?.season || null}
                />
              </section>
            ))
          : "Coming soon..."}
    </>
  );
}
