import { useEffect, useState } from "react";
import { MdArrowUpward } from "react-icons/md";
import List, { type ListProps } from "./List";
import ListItems from "./ListItems";

function scrollToTop() {
  window.scroll({
    top: 0,
    behavior: "smooth",
  });
}

export default function Lists() {
  const [selectedList, setSelectedList] = useState<number | null>(null);
  const [lists, setLists] = useState<ListProps[]>([]);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const toggleVisibility = () => {
      // Show button if scrolled down past 300px, otherwise hide it
      if (window.scrollY > 300) {
        setIsVisible(true);
      } else {
        setIsVisible(false);
      }
    };

    window.addEventListener("scroll", toggleVisibility);

    // Clean up the event listener when component unmounts
    return () => window.removeEventListener("scroll", toggleVisibility);
  }, []);

  useEffect(() => {
    if (selectedList !== null) {
      return;
    }

    const loadLists = async () => {
      try {
        const response = await fetch("/api/lists", {
          method: "GET",
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error ?? "Request failed");
        }

        setLists(data);
      } catch (error) {
        console.error("Error fetching lists.", error);
      }
    };
    loadLists();
  }, [selectedList]);

  const selectList = (listIndex: number) => {
    setSelectedList(listIndex);
  };

  const activeList =
    (selectedList || selectedList === 0) && lists[selectedList];

  return (
    <>
      {activeList ? (
        <ListItems
          {...activeList}
          back={() => {
            setSelectedList(null);
          }}
        />
      ) : (
        <>
          {lists.map((list, i) => (
            <section
              key={`list-${list.id}`}
              className="clickable panel"
              onClick={() => selectList(i)}
            >
              <List {...list} />
            </section>
          ))}
        </>
      )}
      {isVisible && (
        <div
          className="scroll-to-top"
          title="Scroll to top"
          onClick={scrollToTop}
        >
          <MdArrowUpward />
        </div>
      )}
    </>
  );
}
