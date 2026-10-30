import floorsConfig from "../config/floors.json";

export async function loadAllFloors() {
  const base = import.meta.env.BASE_URL;

  const allPathFeatures = [];
  const allExhibits = [];

  const floorLoadResults = await Promise.allSettled(
    floorsConfig.map(async (floor) => {
      const folder = floor.tileFolder;

      const pathsUrl = `${base}data/${folder}/paths.json`;
      const exhibitsUrl = `${base}data/${folder}/exhibits.json`;

      const [pathsRes, exhibitsRes] = await Promise.all([
        fetch(pathsUrl),
        fetch(exhibitsUrl),
      ]);

      if (!pathsRes.ok) {
        throw new Error(`Missing paths.json for floor ${floor.id}`);
      }

      if (!exhibitsRes.ok) {
        throw new Error(`Missing exhibits.json for floor ${floor.id}`);
      }

      const pathsJson = await pathsRes.json();
      const exhibitsJson = await exhibitsRes.json();

      // Normalize floor property on paths
      const normalizedPaths = (pathsJson.features || []).map((f) => ({
        ...f,
        properties: {
          ...f.properties,
          floor: Number(floor.id),
        },
      }));

      // Normalize floor property on exhibits
      const normalizedExhibits = (exhibitsJson || []).map((e) => ({
        ...e,
        floor: Number(floor.id),
      }));

      return {
        paths: normalizedPaths,
        exhibits: normalizedExhibits,
      };
    })
  );

  // Collect only fulfilled floors
  floorLoadResults.forEach((result, index) => {
    if (result.status === "fulfilled") {
      allPathFeatures.push(...result.value.paths);
      allExhibits.push(...result.value.exhibits);
    } else {
      console.warn(
        `⚠️ Floor ${floorsConfig[index].id} failed to load:`,
        result.reason.message
      );
    }
  });

  return {
    pathData: {
      type: "FeatureCollection",
      features: allPathFeatures,
    },
    exhibitsData: allExhibits,
  };
}
