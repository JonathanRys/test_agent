import { useState } from "react";
import type { List } from "../types/List";
import type { Mountain as MountainType } from "../types/Mountain";
import { MdArrowDropDown, MdArrowDropUp, MdForest } from "react-icons/md";
import { PiSignpost } from "react-icons/pi";
import { FaMountain } from "react-icons/fa6";
import StateIcon from "./State";
import Map from "./Map";
import MarkComplete, {
  earliestCompleted,
  seasonOrder,
  sortCompletionsByDate,
} from "./MarkComplete";
import CompletionDate from "./CompletionDate";
import GridIcon from "./GridIcon";
import Season from "./Season";
import { useAuth } from "../auth/AuthContext";

export interface MountainProps extends MountainType {
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

const Mountain = (props: MountainProps) => {
  const { user } = useAuth();
  const {
    index,
    name,
    height,
    prominence,
    distance,
    state,
    range,
    bushwhack,
    notes,
    Lists,
    lat,
    lon,
    expanded,
    Summits,
    onComplete,
    id,
    season,
  } = props;

  const [showMap, setShowMap] = useState<boolean>(false);
  const [mountainExpanded, setMountainExpanded] = useState<boolean>(expanded);
  const [editingCompletionId, setEditingCompletionId] = useState<number | null>(
    null,
  );

  const bushwhackIcon = bushwhack ? (
    <MdForest title="Bushwhack" />
  ) : (
    <PiSignpost title="Marked Trail" />
  );

  const mountainIcon = <FaMountain title="Mountain" />;
  const earliestCompletedSummit = user ? earliestCompleted(Summits) : undefined;
  const completedAt = earliestCompletedSummit?.completedAt;
  const extractMonthIndex = (dateString: string) => {
    const date = new Date(dateString);
    return date.getMonth();
  };
  const completionItems = sortCompletionsByDate(Summits ?? []);
  const completedSeasons = Array.from(
    new Set(completionItems.map((summit) => summit.season).filter(Boolean)),
  ).sort(
    (left, right) => seasonOrder.indexOf(left!) - seasonOrder.indexOf(right!),
  ) as string[];
  const completions = user
    ? completionItems.reduce(
        (acc, summit) => {
          if (summit.completedAt) {
            const month = extractMonthIndex(summit.completedAt);
            acc[month] = [
              ...(acc[month] ?? []),
              { completedAt: summit.completedAt },
            ];
          }
          return acc;
        },
        {} as Record<number, Array<{ completedAt: string }>>,
      )
    : undefined;

  return (
    <div
      className={`${mountainExpanded ? "" : "clickable align-center"}${user && completedAt ? " item-completed" : ""}`}
      onClick={() => {
        setShowMap(mountainExpanded ? false : showMap);
        setMountainExpanded(!mountainExpanded);
      }}
    >
      <div className={`${mountainExpanded ? "item-header" : "inline"}`}>
        <span>#{index}</span>
        {mountainExpanded && (
          <span>
            {Lists?.map((list) => (
              <ListBubble key={`list${list.id}`} {...list} />
            ))}
          </span>
        )}
      </div>
      <h2
        className={`clickable split-title${mountainExpanded ? "" : " inline"}`}
      >
        <span>
          {mountainIcon} {name}{" "}
          {state && (
            <span className="state-icon" title={state.name}>
              {StateIcon({ state: state.abbreviation })}
            </span>
          )}
        </span>{" "}
        {bushwhackIcon}
      </h2>
      {mountainExpanded && (
        <div>
          <p>Height: {height} ft</p>
          {prominence && <p>Prominence: {prominence} ft</p>}
          {distance && <p>Distance: {distance} mi</p>}
          {range && <p>Range: {range}</p>}
          <p>{notes}</p>
          <div className="space-between-row">
            {user && (
              <div className="completion-summary">
                <div className="completion-section-label">Hiked:</div>
                {completionItems.map((summit) => (
                  <CompletionDate
                    key={summit.id}
                    adventureId={summit.adventureId}
                    mountainId={id}
                    name={name}
                    completedAt={summit.completedAt}
                    editing={editingCompletionId === summit.id}
                    setEditing={(editing) =>
                      setEditingCompletionId(editing ? summit.id : null)
                    }
                    onComplete={onComplete}
                    season={summit.season}
                  />
                ))}
                {completedSeasons.length > 0 && (
                  <div
                    className="completion-seasons"
                    aria-label="Seasons hiked"
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
                    mountainId={id}
                    onComplete={onComplete}
                  />
                )}
              </div>
            )}
            {user && completedAt && <GridIcon completions={completions} />}
          </div>
          {lat && lon && showMap ? (
            <>
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
              <Map lat={lat} lon={lon} />
            </>
          ) : (
            lat &&
            lon && (
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
      )}
    </div>
  );
};

export default Mountain;
