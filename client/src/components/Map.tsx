import {
  APIProvider,
  Map as GoogleMap,
  AdvancedMarker,
} from "@vis.gl/react-google-maps";

const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

interface MapProps {
  lat: number;
  lon: number;
  zoom?: number;
}

const Map = (props: MapProps) => {
  const { lat, lon, zoom } = props;

  const position = { lat: lat, lng: lon };

  return (
    <div className="centered" onClick={(event) => event.stopPropagation()}>
      <APIProvider apiKey={apiKey}>
        <div style={{ height: "500px", width: "100%" }}>
          <GoogleMap
            defaultCenter={position}
            defaultZoom={12}
            mapId="DEMO_MAP_ID" // Required for modern Advanced Markers
          >
            {/* 3. Drop a child marker component directly on the map */}
            <AdvancedMarker position={position} title="My Location" />
          </GoogleMap>
        </div>
      </APIProvider>
    </div>
  );
};

export default Map;
