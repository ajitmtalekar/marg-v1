import { useState, useMemo } from "react";
import "../src/styles/admin.css";

/* ================= UTIL ================= */

function downloadJSON(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json"
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function hasDuplicateExhibit(exhibits, index, field, value) {
  const v = value.trim().toLowerCase();
  if (!v) return false;

  return exhibits.some(
    (e, i) =>
      i !== index &&
      String(e[field]).trim().toLowerCase() === v
  );
}


/* ================= COMPONENT ================= */

export default function DataAdmin() {
  const [exhibits, setExhibits] = useState([]);
  const [paths, setPaths] = useState([]);
  const [activeTab, setActiveTab] = useState("exhibits");


  /* ================= VALIDATION ================= */

  const exhibitErrors = useMemo(() => {
    const errs = [];
    const ids = new Set();

    exhibits.forEach((e, i) => {
      if (!e.id) errs.push(`Exhibit[${i}] missing id`);
      if (ids.has(e.id)) errs.push(`Duplicate exhibit id: ${e.id}`);
      ids.add(e.id);

      if (!e.name) errs.push(`Exhibit ${e.id}: name required`);

      if (
        !Array.isArray(e.coords) ||
        e.coords.length !== 2 ||
        e.coords.some(c => typeof c !== "number")
      ) {
        errs.push(`Exhibit ${e.id}: coords must be [lng, lat]`);
      }

      if (!e.category) errs.push(`Exhibit ${e.id}: category required`);
      if (!e.color) errs.push(`Exhibit ${e.id}: color required`);
      if (typeof e.floor !== "number") errs.push(`Exhibit ${e.id}: floor invalid`);
      if (!e.access) errs.push(`Exhibit ${e.id}: access required`);
      if (!Array.isArray(e.roles)) errs.push(`Exhibit ${e.id}: roles must be array`);
      if (typeof e.emergencyAssemblyPoint !== "boolean")
        errs.push(`Exhibit ${e.id}: emergencyAssemblyPoint must be boolean`);
    });

    return errs;
  }, [exhibits]);

  const pathErrors = useMemo(() => {
  if (!paths || paths.length === 0) {
    console.warn("⏳ Skipping path validation: paths not loaded yet");
    return [];
  }

  const errors = [];
  console.group("🔍 Path Validation");

  // ---- Build node universe from paths ----
  const nodeIdSet = new Set();
  paths.forEach(p => {
    if (p.properties?.from) nodeIdSet.add(p.properties.from);
    if (p.properties?.to) nodeIdSet.add(p.properties.to);
  });

  console.log("Known path nodes:", [...nodeIdSet]);

  const pathIds = new Set();

  paths.forEach((p, i) => {
    console.group(`➡️ Path[${i}]`);

    if (!p.properties) {
      errors.push(`Path[${i}] missing properties`);
      console.groupEnd();
      return;
    }

    const { id, from, to } = p.properties;

    // ---- ID ----
    if (!id) errors.push(`Path[${i}] missing properties.id`);

    if (pathIds.has(id)) {
      errors.push(`Duplicate path id '${id}'`);
    }
    pathIds.add(id);

    // ---- from / to ----
    if (!from) errors.push(`Path ${id}: missing 'from'`);
    if (!to) errors.push(`Path ${id}: missing 'to'`);

    if (from && !nodeIdSet.has(from)) {
      errors.push(`Path ${id}: from node '${from}' not found`);
    }

    if (to && !nodeIdSet.has(to)) {
      errors.push(`Path ${id}: to node '${to}' not found`);
    }

    // ---- Derived ID rule ----
    const expectedId = `${from}_to_${to}`;
    if (id && id !== expectedId) {
      errors.push(`Path id '${id}' must be '${expectedId}'`);
    }

    // ---- Geometry ----
    if (
      !Array.isArray(p.geometry?.coordinates) ||
      p.geometry.coordinates.length < 2
    ) {
      errors.push(`Path ${id}: invalid geometry`);
    }

    console.groupEnd();
  });

  console.groupEnd();
  return errors;
}, [paths]);



  /* ================= IMPORT ================= */

  function importExhibits(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (!Array.isArray(data)) throw new Error("Invalid exhibits.json");
        setExhibits(data);
      } catch (e) {
        alert(e.message);
      }
    };
    reader.readAsText(file);
  }

  function importPaths(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (data.type !== "FeatureCollection")
          throw new Error("Invalid paths.json");
        setPaths(data.features);
      } catch (e) {
        alert(e.message);
      }
    };
    reader.readAsText(file);
  }

  /* ================= CRUD ================= */

  function addExhibit() {
    setExhibits(e => [
      ...e,
      {
        id: "",
        name: "",
        coords: [0, 0],
        category: "",
        color: "#000000",
        floor: 0,
        access: "public",
        roles: [],
        emergencyAssemblyPoint: false
      }
    ]);
  }

  function updateExhibit(index, field, value) {
    setExhibits(prev => {
      // Duplicate check only for id & name
      if ((field === "id" || field === "name") &&
        hasDuplicateExhibit(prev, index, field, value)) {
        alert(`Duplicate exhibit ${field} not allowed`);
        return prev;
      }

      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  }


  function deleteExhibit(i) {
    const id = exhibits[i].id;
    setExhibits(e => e.filter((_, idx) => idx !== i));
    setPaths(p =>
      p.filter(
        x => x.properties.from !== id && x.properties.to !== id
      )
    );
  }

  const EXHIBIT_GRID = {
    gridTemplateColumns:
      "140px 180px 140px 80px 130px 130px 80px 120px 200px 120px 110px"
  };

  const cellInputStyle = {
    width: "100%",
    boxSizing: "border-box"
  };

  // Make sure the grid columns match your fields, including coordinates
  const PATH_GRID = {
    gridTemplateColumns:
      "150px 100px 80px 100px 100px 60px 100px 150px 60px 80px 80px 367px 90px"
  };

  function validatePaths(paths) {
    const ids = new Set();
    for (const p of paths) {
      if (!p.properties.id) return "Path ID is required";
      if (ids.has(p.properties.id)) return "Duplicate Path ID";
      ids.add(p.properties.id);

      if (!p.properties.from || !p.properties.to)
        return "From / To exhibits are required";

      if (!Array.isArray(p.geometry.coordinates) || p.geometry.coordinates.length < 2)
        return "Path must have at least 2 coordinates";
    }
    return null;
  }

  function addPath() {
    setPaths(p => [
      ...p,
      {
        type: "Feature",
        properties: {
          id: "",
          routeType: "primary",
          oneway: "both",
          from: "",
          to: "",
          floor: 0,
          access: "public",
          modes: ["normal"],
          weight: 1,
          status: "open",
          color: "#62f545"
        },
        geometry: {
          type: "LineString",
          coordinates: [
            [0, 0],
            [0, 0]
          ] // default two-point line
        }
      }
    ]);
  }

  function updatePath(index, fieldPath, value) {
    setPaths(p =>
      p.map((path, i) => {
        if (i !== index) return path;
        if (fieldPath.startsWith("geometry.")) {
          const coordsIndex = Number(fieldPath.split(".")[1]);
          const coordPos = fieldPath.split(".")[2]; // 0 = lng, 1 = lat
          const newCoords = path.geometry.coordinates.map(arr => [...arr]);
          newCoords[coordsIndex][coordPos] = Number(value);
          return { ...path, geometry: { ...path.geometry, coordinates: newCoords } };
        } else if (fieldPath === "modes") {
          return {
            ...path,
            properties: { ...path.properties, modes: value.split(",").map(s => s.trim()) }
          };
        } else {
          return {
            ...path,
            properties: { ...path.properties, [fieldPath]: value }
          };
        }
      })
    );
  }

  function deletePath(index) {
    setPaths(p => p.filter((_, i) => i !== index));
  }

  function addCoordinate(pathIndex) {
    setPaths(p =>
      p.map((path, i) => {
        if (i !== pathIndex) return path;
        return {
          ...path,
          geometry: {
            ...path.geometry,
            coordinates: [...path.geometry.coordinates, [0, 0]]
          }
        };
      })
    );
  }

  function removeCoordinate(pathIndex, coordIndex) {
    setPaths(p =>
      p.map((path, i) => {
        if (i !== pathIndex) return path;
        return {
          ...path,
          geometry: {
            ...path.geometry,
            coordinates: path.geometry.coordinates.filter((_, j) => j !== coordIndex)
          }
        };
      })
    );
  }

  /*
  Feature<LineString, {
    id: string
    routeType: "primary" | "secondary" | "service"
    oneway: "both" | "forward" | "reverse"
    from: string
    to: string
    floor: number
    access: "public" | "staff" | "restricted"
    modes: ("normal" | "emergency")[]
    weight: number
    status: "open" | "closed"
    color: string
  }>
  
  */

  /* ================= UI ================= */

  return (
    <div className="admin">

      {/* ===== TITLE ===== */}
      <h2>Data Admin</h2>

      {/* ===== TABS ===== */}
      <div className="tabs">
        <button
          className={activeTab === "exhibits" ? "active" : ""}
          onClick={() => setActiveTab("exhibits")}
        >
          Exhibits ({exhibits.length})
        </button>

        <button
          className={activeTab === "paths" ? "active" : ""}
          onClick={() => setActiveTab("paths")}
        >
          Paths ({paths.length})
        </button>
      </div>

      {/* ===== EXHIBITS TAB ===== */}
      {activeTab === "exhibits" && (
        <>
          <h3>Exhibits</h3>

          <input
            type="file"
            accept=".json"
            onChange={e => importExhibits(e.target.files[0])}
          />

          <button
            disabled={exhibitErrors.length > 0}
            onClick={() => downloadJSON(exhibits, "exhibits.json")}
          >
            Save Exhibits
          </button>

          {exhibitErrors.map((e, i) => (
            <div key={i} style={{ color: "red" }}>{e}</div>
          ))}

          <button onClick={addExhibit}>+ Add Exhibit</button>

          <div className="exhibit-grid-wrapper">

            {/* ===== HEADER ===== */}
            <div className="exhibit-grid header">
              <div>ID</div>
              <div>Name</div>
              <div>Category</div>
              <div>Color</div>
              <div>Longitude</div>
              <div>Latitude</div>
              <div>Floor</div>
              <div>Access</div>
              <div>Roles</div>
              <div>Emergency</div>
              <div>Action</div>
            </div>

            {/* ===== ROWS ===== */}
            {exhibits.map((e, i) => (
              <div key={e.id || i} className="exhibit-grid row">

                <input
                  value={e.id}
                  onChange={ev => updateExhibit(i, "id", ev.target.value)}
                />

                <input
                  value={e.name}
                  onChange={ev => updateExhibit(i, "name", ev.target.value)}
                />

                <input
                  value={e.category}
                  onChange={ev => updateExhibit(i, "category", ev.target.value)}
                />

                <input
                  type="color"
                  value={e.color}
                  onChange={ev => updateExhibit(i, "color", ev.target.value)}
                />

                <input
                  type="number"
                  step="any"
                  value={e.coords[0]}
                  onChange={ev =>
                    updateExhibit(i, "coords", [Number(ev.target.value), e.coords[1]])
                  }
                />

                <input
                  type="number"
                  step="any"
                  value={e.coords[1]}
                  onChange={ev =>
                    updateExhibit(i, "coords", [e.coords[0], Number(ev.target.value)])
                  }
                />

                <input
                  type="number"
                  value={e.floor}
                  onChange={ev => updateExhibit(i, "floor", Number(ev.target.value))}
                />

                <select
                  value={e.access}
                  onChange={ev => updateExhibit(i, "access", ev.target.value)}
                >
                  <option value="public">Public</option>
                  <option value="staff">Staff</option>
                  <option value="restricted">Restricted</option>
                </select>

                <input
                  value={e.roles.join(",")}
                  onChange={ev =>
                    updateExhibit(
                      i,
                      "roles",
                      ev.target.value
                        .split(",")
                        .map(r => r.trim())
                        .filter(Boolean)
                    )
                  }
                />

                <input
                  type="checkbox"
                  checked={e.emergencyAssemblyPoint}
                  onChange={ev =>
                    updateExhibit(i, "emergencyAssemblyPoint", ev.target.checked)
                  }
                />

                <button onClick={() => deleteExhibit(i)}>Delete</button>

                {hasDuplicateExhibit(exhibits, i, "id", e.id) && (
                  <div className="exhibit-error">Duplicate ID</div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {/* ===== PATHS TAB ===== */}
      {activeTab === "paths" && (
        <>
          <h3>Paths</h3>

          <input
            type="file"
            accept=".json"
            onChange={e => importPaths(e.target.files[0])}
          />

          <button
            disabled={pathErrors.length > 0}
            onClick={() =>
              downloadJSON(
                { type: "FeatureCollection", features: paths },
                "paths.json"
              )
            }
          >
            Save Paths
          </button>

          {pathErrors.map((e, i) => (
            <div key={i} style={{ color: "red" }}>{e}</div>
          ))}

          <button onClick={addPath}>+ Add Path</button>

          <div className="exhibit-grid-wrapper">
            <div className="exhibit-grid header">
              <div>ID</div>
              <div>Route Type</div>
              <div>Oneway</div>
              <div>From</div>
              <div>To</div>
              <div>Floor</div>
              <div>Access</div>
              <div>Modes</div>
              <div>Weight</div>
              <div>Status</div>
              <div>Color</div>
              <div>Coordinates</div>
              <div>Action</div>
            </div>

            {paths.map((p, i) => (
               <div key={p.properties.id || `path-${i}`} className="exhibit-grid row">

                <input
                  value={p.properties.id}
                  onChange={e => updatePath(i, "id", e.target.value)}
                />

                <select
                  value={p.properties.routeType}
                  onChange={e => updatePath(i, "routeType", e.target.value)}
                >
                  <option>primary</option>
                  <option>secondary</option>
                  <option>service</option>
                </select>

                <select
                  value={p.properties.oneway}
                  onChange={e => updatePath(i, "oneway", e.target.value)}
                >
                  <option>both</option>
                  <option>forward</option>
                  <option>reverse</option>
                </select>

                <input
                  value={p.properties.from}
                  onChange={e => updatePath(i, "from", e.target.value)}
                />

                <input
                  value={p.properties.to}
                  onChange={e => updatePath(i, "to", e.target.value)}
                />

                <input
                  type="number"
                  value={p.properties.floor}
                  onChange={e => updatePath(i, "floor", Number(e.target.value))}
                />

                <select
                  value={p.properties.access}
                  onChange={e => updatePath(i, "access", e.target.value)}
                >
                  <option>public</option>
                  <option>staff</option>
                  <option>restricted</option>
                </select>

                <input
                  value={p.properties.modes.join(",")}
                  onChange={e => updatePath(i, "modes", e.target.value)}
                />

                <input
                  type="number"
                  step="0.1"
                  value={p.properties.weight}
                  onChange={e => updatePath(i, "weight", Number(e.target.value))}
                />

                <select
                  value={p.properties.status}
                  onChange={e => updatePath(i, "status", e.target.value)}
                >
                  <option>open</option>
                  <option>closed</option>
                </select>

                <input
                  type="color"
                  value={p.properties.color}
                  onChange={e => updatePath(i, "color", e.target.value)}
                />

                {/* ===== COORDINATES EDITOR ===== */}
                  <div className="coords-cell">
                      {p.geometry.coordinates.map((coord, j) => (
                        <div key={j} className="coords-row">
                          <input
                            type="number"
                            step="any"
                            value={coord[0]}
                            onChange={e => updatePath(i, `geometry.${j}.0`, e.target.value)}
                            placeholder="Lng"
                          />
                          <input
                            type="number"
                            step="any"
                            value={coord[1]}
                            onChange={e => updatePath(i, `geometry.${j}.1`, e.target.value)}
                            placeholder="Lat"
                          />
                          <button onClick={() => removeCoordinate(i, j)}>-</button>
                        </div>
                      ))}
                      <button onClick={() => addCoordinate(i)}>+ Add</button>
                    </div>


                <button onClick={() => deletePath(i)}>Delete</button>
              </div>
            ))}
          </div>

        </>


      )}
    </div>
  );


}
