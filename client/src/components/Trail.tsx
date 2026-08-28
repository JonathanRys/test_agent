import { GiTrail } from "react-icons/gi";
import type { Trail as TrailType } from "../types/Trail";
import StateIcon from "./State";
import MarkComplete, {
  earliestCompletedAt,
  formatCompletedDate,
} from "./MarkComplete";

export interface TrailProps extends TrailType {
  index: number;
  onComplete?: () => void;
}

const Trail = (props: TrailProps) => {
  const {
    id,
    name,
    state,
    description,
    embeddedGpx,
    TrailCompletions,
    onComplete,
  } = props;

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
      <br />
      <div className="centered">
        {embeddedGpx && (
          <iframe src={embeddedGpx} width="640" height="480"></iframe>
        )}
      </div>
    </div>
  );
};

export default Trail;
