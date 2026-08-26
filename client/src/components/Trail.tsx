import type { LineString } from "geojson";
import { GiTrail } from "react-icons/gi";
import type { State } from "../types/State";
import StateIcon from "./State";
import MarkComplete, {
  earliestCompletedAt,
  formatCompletedDate,
} from "./MarkComplete";

export interface TrailProps {
  id: number;
  index: number;
  name: string;
  description?: string;
  state?: State;
  distance?: number;
  elevationGain?: number;
  elevationLoss?: number;
  startLat?: number;
  startLon?: number;
  endLat?: number;
  endLon?: number;
  gpx?: LineString;
  embeddedGpx?: string;
  TrailCompletions?: Array<{ completedAt: string }>;
  onComplete?: () => void;
}

const Trail = (props: TrailProps) => {
  const { id, name, state, description, embeddedGpx, TrailCompletions, onComplete } =
    props;

  const trailIcon = <GiTrail title="Trail" />;
  const completedAt = earliestCompletedAt(TrailCompletions);

  return (
    <div className={completedAt ? "item-completed" : ""}>
      <h2>
        {trailIcon} {name}{" "}
        {state && (
          <span title={state.name}>
            {StateIcon({ state: state.abbreviation })}
          </span>
        )}
      </h2>
      <p>{description}</p>
      {completedAt ? (
        <p className="completion-date">
          Completed {formatCompletedDate(completedAt)}
        </p>
      ) : (
        onComplete && (
          <MarkComplete name={name} trailId={id} onComplete={onComplete} />
        )
      )}
      <div className="centered">
        {embeddedGpx && (
          <iframe src={embeddedGpx} width="640" height="480"></iframe>
        )}
      </div>
    </div>
  );
};

export default Trail;
