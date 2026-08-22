import { useState } from "react";
import { MdArrowDropDown, MdForest } from "react-icons/md";
import { PiSignpost } from "react-icons/pi";
import { FaMountain } from "react-icons/fa6";
import StateIcon from "./State";
import Map from "./Map";

type List = {
  id: number;
  name: string;
  abbreviation: string;
};

export interface MountainProps {
  id: number;
  index: number;
  name: string;
  height: number;
  prominence: number;
  distance?: number;
  state: string;
  range?: string;
  bushwhack?: boolean;
  notes?: string;
  Lists?: List[];
  lat?: number;
  lon?: number;
  expanded: boolean;
}

const ListBubble = (props: List) => {
  const { name, abbreviation } = props;

  return (
    <span className="meta-pill" title={name}>
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
  } = props;

  const [showMap, setShowMap] = useState<boolean>(false);
  const [mountainExpanded, setMountainExpanded] = useState<boolean>(expanded);

  const bushwhackIcon = bushwhack ? (
    <MdForest title="Bushwhack" />
  ) : (
    <PiSignpost title="Marked Trail" />
  );

  const mountainIcon = <FaMountain title="Mountain" />;

  return (
    <div
      className={`${mountainExpanded ? "" : "clickable align-center"}`}
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
          <span title={state}>{StateIcon({ state })}</span>
        </span>{" "}
        {bushwhackIcon}
      </h2>
      {mountainExpanded && (
        <div>
          <p>Height: {height} ft</p>
          <p>Prominence: {prominence} ft</p>
          {distance && <p>Distance: {distance} mi</p>}
          {range && <p>Range: {range}</p>}
          <p>{notes}</p>
          {lat && lon && showMap ? (
            <Map lat={lat} lon={lon} />
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
                <MdArrowDropDown />
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
};

export default Mountain;
