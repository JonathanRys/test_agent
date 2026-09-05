import { useState } from "react";
import { GiTrail } from "react-icons/gi";
import type { Trail as TrailType } from "../types/Trail";
import StateIcon from "./State";
import MarkComplete, { earliestCompleted } from "./MarkComplete";
import CompletionDate from "./CompletionDate";

export interface TrailProps extends TrailType {
  index: number;
  expanded: boolean;
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
    expanded,
    season,
    onComplete,
  } = props;

  const [showMap, setShowMap] = useState<boolean>(false);
  const [mountainExpanded, setMountainExpanded] = useState<boolean>(expanded);
  const [editing, setEditing] = useState<boolean>(false);

  const trailIcon = <GiTrail title="Trail" />;
  const earliestCompletedTrail = earliestCompleted(TrailCompletions);
  const completedAt = earliestCompletedTrail?.completedAt;

  return (
    <div className={completedAt ? "item-completed" : ""}>
      <h2>
        {trailIcon} {name}{" "}
        {state && (
          <span className="state-icon" title={state.name}>
            {StateIcon({ state: state.abbreviation })}
          </span>
        )}
      </h2>
      <p>{description}</p>
      {completedAt ? (
        <CompletionDate
          adventureId={earliestCompletedTrail?.id}
          mountainId={id}
          name={name}
          completedAt={completedAt}
          editing={editing}
          setEditing={setEditing}
          onComplete={onComplete}
          season={season}
        />
      ) : (
        onComplete && (
          <MarkComplete name={name} mountainId={id} onComplete={onComplete} />
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
