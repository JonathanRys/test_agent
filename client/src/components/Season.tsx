import { FaSeedling, FaSun, FaLeaf, FaSnowflake } from "react-icons/fa6";
import { GiFlowerEmblem, GiMapleLeaf } from "react-icons/gi";

interface SeasonProps {
  season: string;
}

const Season = (props: SeasonProps) => {
  const { season } = props;
  switch (season) {
    case "Spring":
      return <span>🌸</span>;
    case "Summer":
      return <span>☀️</span>;
    case "Autumn":
      return <span>🍁</span>;
    case "Winter":
      return <span>❄️</span>;
    default:
      return null;
  }
};

export default Season;
