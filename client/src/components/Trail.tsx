import { useState } from "react";
import { GiTrail } from "react-icons/gi";
import type { Trail as TrailType } from "../types/Trail";
import StateIcon from "./State";
import MarkComplete, { earliestCompleted } from "./MarkComplete";
import CompletionDate from "./CompletionDate";
import GridIcon from "./GridIcon";
import { MdArrowDropDown, MdArrowDropUp } from "react-icons/md";
import { List } from "../types/List";

export interface TrailProps extends TrailType {
  index: number;
  expanded: boolean;
  onComplete?: () => void;
}

const ListBubble = (props: List) => {
  const { name, abbreviation } = props;

  return (
    <span className="meta-pill normal-cursor" title={name}>
      {abbreviation}
    </span>
  );
};

const Trail = (props: TrailProps) => {
  const {
    index,
    id,
    name,
    state,
    description,
    embeddedGpx,
    TrailCompletions,
    expanded,
    season,
    Lists,
    onComplete,
  } = props;

  const [showMap, setShowMap] = useState<boolean>(false);
  const [trailCompletionExpanded, setTrailCompletionExpanded] =
    useState<boolean>(expanded);
  const [editing, setEditing] = useState<boolean>(false);

  const trailIcon = <GiTrail title="Trail" />;
  const earliestCompletedTrail = earliestCompleted(TrailCompletions);
  const earliestCompletedSeason = earliestCompletedTrail?.season;
  const completedAt = earliestCompletedTrail?.completedAt;
  const extractMonthIndex = (dateString: string) => {
    const date = new Date(dateString);
    return date.getMonth();
  };
  const completions = TrailCompletions?.reduce(
    (acc, trailCompletion) => {
      if (trailCompletion.completedAt) {
        acc[extractMonthIndex(trailCompletion.completedAt)] = {
          completedAt: trailCompletion.completedAt,
        };
      }
      return acc;
    },
    {} as Record<number, { completedAt: string }>,
  );

  return (
    <div
      className={`${trailCompletionExpanded ? "" : "clickable align-center"}${completedAt ? " item-completed" : ""}`}
      onClick={() => {
        setShowMap(trailCompletionExpanded ? false : showMap);
        setTrailCompletionExpanded(!trailCompletionExpanded);
      }}
    >
      <div className={`${trailCompletionExpanded ? "item-header" : "inline"}`}>
        <span>#{index}</span>
        {trailCompletionExpanded && (
          <span>
            {Lists?.map((list) => (
              <ListBubble key={`list${list.id}`} {...list} />
            ))}
          </span>
        )}
      </div>
      <h2
        className={`clickable split-title${trailCompletionExpanded ? "" : " inline"}`}
      >
        <span>
          {trailIcon} {name}{" "}
          {state && (
            <span className="state-icon" title={state.name}>
              {StateIcon({ state: state.abbreviation })}
            </span>
          )}
        </span>
      </h2>
      {trailCompletionExpanded && (
        <div>
          <p>{description}</p>
          <div className="space-between-row">
            {completedAt ? (
              <CompletionDate
                adventureId={earliestCompletedTrail?.id}
                mountainId={id}
                name={name}
                completedAt={completedAt}
                editing={editing}
                setEditing={setEditing}
                onComplete={onComplete}
                season={earliestCompletedSeason || season}
              />
            ) : (
              onComplete && (
                <MarkComplete
                  name={name}
                  trailId={id}
                  onComplete={onComplete}
                />
              )
            )}
            {completedAt && <GridIcon completions={completions} />}
          </div>
          <br />
          <div className="centered">
            {embeddedGpx && showMap ? (
              <div>
                {" "}
                <div
                  className="centered clickable"
                  onClick={(event) => {
                    event.stopPropagation();
                    setShowMap(false);
                  }}
                >
                  <MdArrowDropUp style={{ fontSize: "24px" }} />
                </div>
                <div
                  className="centered"
                  onClick={(event) => event.stopPropagation()}
                >
                  <iframe src={embeddedGpx} width="640" height="480"></iframe>
                </div>
              </div>
            ) : (
              embeddedGpx && (
                <div
                  className="centered clickable"
                  onClick={(event) => {
                    event.stopPropagation();
                    setShowMap(true);
                  }}
                >
                  Show on Map&nbsp;
                  <MdArrowDropDown style={{ fontSize: "24px" }} />
                </div>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Trail;
