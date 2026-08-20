import { MdForest } from "react-icons/md";
import { PiSignpost } from "react-icons/pi";
import { FaMountain } from "react-icons/fa6";
import StateIcon from "./State";

export interface MountainProps {
  id: number;
  name: string;
  height: number;
  prominence: number;
  distance?: number;
  state: string;
  range?: string;
  bushwhack?: boolean;
  notes?: string;
  lat?: number;
  lon?: number;
}

const Mountain = (props: MountainProps) => {
  const {
    name,
    height,
    prominence,
    distance,
    state,
    range,
    bushwhack,
    notes,
    lat,
    lon,
  } = props;
  const bushwhackIcon = bushwhack ? (
    <MdForest title="Bushwhack" />
  ) : (
    <PiSignpost title="Marked Trail" />
  );
  const mountainIcon = <FaMountain title="Mountian" />;
  return (
    <div>
      <h2 className="split-title">
        <span>
          {mountainIcon} {name}{" "}
          <span title={state}>{StateIcon({ state })}</span>
        </span>{" "}
        {bushwhackIcon}
      </h2>
      <p>Height: {height} ft</p>
      <p>Prominence: {prominence} ft</p>
      {distance && <p>Distance: {distance} mi</p>}
      {range && <p>Range: {range}</p>}
      <p>Notes: {notes}</p>
      {lat && lon && <div>Show Map</div>}
    </div>
  );
};

export default Mountain;
