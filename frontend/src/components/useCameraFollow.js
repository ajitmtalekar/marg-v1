import { useEffect, useState, useCallback } from "react";
import L from "leaflet";

function isValidLatLng(pos) {
  return (
    Array.isArray(pos) &&
    pos.length === 2 &&
    Number.isFinite(pos[0]) &&
    Number.isFinite(pos[1])
  );
}

export function useCameraFollow(mapRef, userPos) {
  const [isFollowing, setIsFollowing] = useState(true);
  const [hasMovedAway, setHasMovedAway] = useState(false);

  const recenter = useCallback(() => {
    if (!mapRef.current) return;
    if (!isValidLatLng(userPos)) return;

    mapRef.current.setView(
      userPos,
      mapRef.current.getZoom(),
      {
        animate: false,
        noMoveStart: true,
      }
    );

    setHasMovedAway(false);
  }, [mapRef, userPos]);

  // Continuous follow
  useEffect(() => {
    if (!isFollowing) return;
    recenter();
  }, [userPos, isFollowing, recenter]);

  // Detect manual map interaction
  useEffect(() => {
    if (!mapRef.current) return;

    const map = mapRef.current;

    const onUserMove = () => {
      setHasMovedAway(true);
      setIsFollowing(false);
    };

    map.on("dragstart zoomstart", onUserMove);

    return () => {
      map.off("dragstart zoomstart", onUserMove);
    };
  }, [mapRef]);

  return {
    isFollowing,
    hasMovedAway,
    recenter,
    startFollowing: () => {
      setIsFollowing(true);
      recenter();
    },
    stopFollowing: () => setIsFollowing(false),
  };
}
