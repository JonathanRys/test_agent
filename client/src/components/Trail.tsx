import type { LineString } from "geojson";
import { GiTrail, GiHiking } from "react-icons/gi";

export interface TrailProps {
  id: number;
  index: number;
  name: string;
  description?: string;
  state?: string;
  distance?: number;
  elevationGain?: number;
  elevationLoss?: number;
  startLat?: number;
  startLon?: number;
  endLat?: number;
  endLon?: number;
  gpx?: LineString;
  embeddedGpx?: string;
}

const Trail = (props: TrailProps) => {
  const { name, description, embeddedGpx } = props;

  const trailIcon = <GiTrail title="Trail" />;

  return (
    <div>
      <h2>
        {trailIcon} {name}
      </h2>
      <p>{description}</p>
      <div className="centered">
        {embeddedGpx && (
          <iframe src={embeddedGpx} width="640" height="480"></iframe>
        )}
      </div>
    </div>
  );
};

export default Trail;
