import { useState } from "react";
import { GiTrail } from "react-icons/gi";
import type { Trail as TrailType } from "../types/Trail";
import StateIcon from "./State";
import MarkComplete, {
  earliestCompleted,
  seasonOrder,
  sortCompletionsByDate,
} from "./MarkComplete";
import CompletionDate from "./CompletionDate";
import GridIcon from "./GridIcon";
import Season from "./Season";
import { MdArrowDropDown, MdArrowDropUp } from "react-icons/md";
import { List } from "../types/List";
import { useAuth } from "../auth/AuthContext";

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
  const { user } = useAuth();
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
  const [editingCompletionId, setEditingCompletionId] = useState<number | null>(
    null,
  );

  const trailIcon = <GiTrail title="Trail" />;
  const earliestCompletedTrail = user
    ? earliestCompleted(TrailCompletions)
    : undefined;
  const completedAt = earliestCompletedTrail?.completedAt;
  const extractMonthIndex = (dateString: string) => {
    const date = new Date(dateString);
    return date.getMonth();
  };
  const completionItems = sortCompletionsByDate(TrailCompletions ?? []);
  const completedSeasons = Array.from(
    new Set(
      completionItems.map((completion) => completion.season).filter(Boolean),
    ),
  ).sort(
    (left, right) => seasonOrder.indexOf(left!) - seasonOrder.indexOf(right!),
  ) as string[];
  const completions = user
    ? completionItems.reduce(
        (acc, trailCompletion) => {
          if (trailCompletion.completedAt) {
            const month = extractMonthIndex(trailCompletion.completedAt);
            acc[month] = [
              ...(acc[month] ?? []),
              { completedAt: trailCompletion.completedAt },
            ];
          }
          return acc;
        },
        {} as Record<number, Array<{ completedAt: string }>>,
      )
    : undefined;

  return (
    <div
      className={`${trailCompletionExpanded ? "" : "clickable align-center"}${user && completedAt ? " item-completed" : ""}`}
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
            {user && (
              <div className="completion-summary">
                <div className="completion-section-label">Hiked:</div>
                {completionItems.map((completion) => (
                  <CompletionDate
                    key={completion.id}
                    adventureId={completion.adventureId}
                    trailId={id}
                    name={name}
                    completedAt={completion.completedAt}
                    editing={editingCompletionId === completion.id}
                    setEditing={(editing) =>
                      setEditingCompletionId(editing ? completion.id : null)
                    }
                    onComplete={onComplete}
                    season={completion.season}
                  />
                ))}
                {completedSeasons.length > 0 && (
                  <div
                    className="completion-seasons"
                    aria-label="Seasons completed"
                  >
                    {completedSeasons.map((completedSeason) => (
                      <span
                        key={completedSeason}
                        className="completion-season"
                        title={completedSeason}
                      >
                        <Season season={completedSeason} />
                      </span>
                    ))}
                  </div>
                )}
                {onComplete && (
                  <MarkComplete
                    name={name}
                    trailId={id}
                    onComplete={onComplete}
                  />
                )}
              </div>
            )}
            {user && completedAt && <GridIcon completions={completions} />}
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
