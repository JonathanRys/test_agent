import { useEffect, useState } from "react";
import { MdArrowUpward } from "react-icons/md";
import List, { type ListProps } from "./List";
import { useAuth } from "../auth/AuthContext";
import { useNavigate } from "react-router-dom";

const listScrollPositionKey = "lists-scroll-position";

function scrollToTop() {
  window.scroll({
    top: 0,
    behavior: "smooth",
  });
}

export default function Lists() {
  const { apiFetch, user } = useAuth();
  const navigate = useNavigate();
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
    const loadLists = async () => {
      try {
        const response = await apiFetch("/api/lists", {
          method: "GET",
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error ?? "Request failed");
        }

        setLists(data);
        window.requestAnimationFrame(() => {
          const savedScrollPosition = sessionStorage.getItem(
            listScrollPositionKey,
          );
          if (savedScrollPosition !== null) {
            window.scrollTo(0, Number(savedScrollPosition));
            sessionStorage.removeItem(listScrollPositionKey);
          }
        });
      } catch (error) {
        console.error("Error fetching lists.", error);
      }
    };
    loadLists();
  }, [user?.id]);

  const selectList = (list: ListProps) => {
    sessionStorage.setItem(listScrollPositionKey, String(window.scrollY));
    navigate(`/list/${list.id}`);
  };

  return (
    <>
      {lists.map((list) => (
        <section
          key={`list-${list.id}`}
          className="clickable panel"
          onClick={() => selectList(list)}
        >
          <List {...list} />
        </section>
      ))}
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
