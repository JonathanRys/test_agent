import { useState } from "react";
import type { List } from "../types/List";
import type { Mountain as MountainType } from "../types/Mountain";
import { MdArrowDropDown, MdArrowDropUp, MdForest } from "react-icons/md";
import { PiSignpost } from "react-icons/pi";
import { FaMountain } from "react-icons/fa6";
import StateIcon from "./State";
import Map from "./Map";
import MarkComplete, { earliestCompleted } from "./MarkComplete";
import CompletionDate from "./CompletionDate";
import Season from "./Season";

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

  // console.log(props);

  const [showMap, setShowMap] = useState<boolean>(false);
  const [mountainExpanded, setMountainExpanded] = useState<boolean>(expanded);
  const [editing, setEditing] = useState<boolean>(false);

  const bushwhackIcon = bushwhack ? (
    <MdForest title="Bushwhack" />
  ) : (
    <PiSignpost title="Marked Trail" />
  );

  const mountainIcon = <FaMountain title="Mountain" />;
  const earliestCompletedSummit = earliestCompleted(Summits);
  const completedAt = earliestCompletedSummit?.completedAt;

  return (
    <div
      className={`${mountainExpanded ? "" : "clickable align-center"}${completedAt ? " item-completed" : ""}`}
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
          {completedAt ? (
            <CompletionDate
              adventureId={earliestCompletedSummit?.id}
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
              <MarkComplete
                name={name}
                mountainId={id}
                onComplete={onComplete}
              />
            )
          )}
          {season && (
            <div>
              <Season season={season} />
            </div>
          )}
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
