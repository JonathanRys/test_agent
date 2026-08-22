import { useEffect, useState } from "react";
import { MdArrowBack } from "react-icons/md";
import Mountain from "./Mountain";
import Trail from "./Trail";

interface ListItemsProps {
  id: number;
  name: string;
  type: "peakbagging" | "trace";
  back: () => {};
}

export default function ListItems(props: ListItemsProps) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const { id, name, type, back } = props;

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
      }
    };
    loadItems();
  }, [id]);

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
      <br />
      {loading
        ? "Loading..."
        : items.length
          ? items.map((item, i) => (
              <section key={`${key}-${item.id}`} className="panel">
                <Item {...item} index={i + 1} />
              </section>
            ))
          : "Coming soon..."}
    </>
  );
}
