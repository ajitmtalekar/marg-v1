import { useMemo } from "react";
import floorsConfig from "../config/floors.json";

export default function useFloorManager({
  selectedFloor,
  pathData,
  routeData,
  exhibitsData
}) {

  const normalizedFloor = selectedFloor != null
    ? Number(selectedFloor)
    : null;

  const defaultFloor =
    floorsConfig.find(f => f.default)?.id ??
    floorsConfig[0]?.id ??
    0;

  const availableFloors = useMemo(() => {
    if (!pathData?.features?.length) return [];

    const usedFloors = new Set(
      pathData.features.map(f =>
        Number(f.properties?.floor ?? 0)
      )
    );

    return floorsConfig
      .filter(f => usedFloors.has(f.id))
      .sort((a, b) => a.id - b.id);

  }, [pathData]);

  const floorPaths = useMemo(() => {
    if (!pathData?.features?.length || normalizedFloor == null)
      return null;

    return {
      type: "FeatureCollection",
      features: pathData.features.filter(
        f => Number(f.properties?.floor ?? 0) === normalizedFloor
      )
    };
  }, [pathData, normalizedFloor]);

  const floorRoute = useMemo(() => {
    if (!routeData?.features?.length || normalizedFloor == null)
      return null;

    const features = routeData.features.filter(
      f => Number(f.properties?.floor ?? 0) === normalizedFloor
    );

    if (!features.length) return null;

    return {
      type: "FeatureCollection",
      features
    };
  }, [routeData, normalizedFloor]);

  const floorPOIs = useMemo(() => {
    if (!exhibitsData?.length || normalizedFloor == null)
      return [];

    return exhibitsData.filter(
      e => Number(e.floor ?? 0) === normalizedFloor
    );
  }, [exhibitsData, normalizedFloor]);

  return {
    defaultFloor,
    availableFloors,
    floorPaths,
    floorRoute,
    floorPOIs
  };
}
