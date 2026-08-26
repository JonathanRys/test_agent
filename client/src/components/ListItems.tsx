import { useEffect, useState } from "react";
import { MdArrowBack } from "react-icons/md";
import Mountain from "./Mountain";
import Trail from "./Trail";

interface ListItemsProps {
  id: number;
  name: string;
  type: "peakbagging" | "trace";
  totalCount?: number;
  completedCount?: number;
  back: () => void;
}

export default function ListItems(props: ListItemsProps) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const { id, name, type, back, totalCount, completedCount } = props;

  let endpoint: string = "/api/mountainList/0";
  let Item = Mountain;
  let key = "mountain";

  switch (type) {
    case "peakbagging":
      endpoint = `/api/mountainList/${id}`;
      Item = Mountain;
      key = "mountain";
      break;
    case "trace":
      endpoint = `/api/trailList/${id}`;
      Item = Trail;
      key = "trail";
      break;
  }

  useEffect(() => {
    const loadItems = async () => {
      try {
        const response = await fetch(endpoint, {
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
      const response = await fetch(endpoint, {
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
      {typeof totalCount === "number" &&
        typeof completedCount === "number" &&
        !loading && (
        <p className="centered list-progress">
          {items.filter((item) =>
            type === "trace"
              ? item.TrailCompletions?.length
              : item.Summits?.length,
          ).length}{" "}
          / {items.length || totalCount} complete
        </p>
      )}
      <br />
      {loading
        ? "Loading..."
        : items.length
          ? items.map((item, i) => (
              <section
                key={`${key}-${item.id}`}
                className={`panel${
                  (type === "trace"
                    ? item.TrailCompletions?.length
                    : item.Summits?.length)
                    ? " panel-completed"
                    : ""
                }`}
              >
                <Item
                  {...item}
                  index={i + 1}
                  onComplete={refreshItems}
                />
              </section>
            ))
          : "Coming soon..."}
    </>
  );
}
