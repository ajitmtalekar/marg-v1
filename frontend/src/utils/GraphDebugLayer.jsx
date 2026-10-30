// GraphDebugLayer.jsx
import React, { useEffect, useState } from "react";

/**
 * GraphDebugLayer
 * Auto overlay for graph debugging.
 * Safe for nodes without id/data-node-id: generates unique keys automatically.
 */
const GraphDebugLayer = ({
  containerId = "graph-container",
  showEdges = false, // future extension
  refreshInterval = 100, // ms
}) => {
  const [nodes, setNodes] = useState([]);
  const [hovered, setHovered] = useState(null);

  useEffect(() => {
    const container = document.getElementById(containerId);
    if (!container) return;

    const updateNodes = () => {
      const nodeElements = container.querySelectorAll(
        "[data-node-id], circle, rect"
      );
      const newNodes = Array.from(nodeElements).map((el, idx) => {
        const rect = el.getBoundingClientRect();
        const parentRect = container.getBoundingClientRect();
        const id = el.getAttribute("data-node-id") || el.id || null;
        return {
          id,
          key: id ? id : `node-${idx}-${Math.random().toString(36).substr(2, 5)}`, // unique key
          x: rect.left + rect.width / 2 - parentRect.left,
          y: rect.top + rect.height / 2 - parentRect.top,
        };
      });
      setNodes(newNodes);
    };

    // Initial update
    updateNodes();

    // Periodic refresh
    const interval = setInterval(updateNodes, refreshInterval);

    // Hover listeners
    const handleMouseOver = (e) => {
      const el = e.target;
      if (
        el.tagName === "circle" ||
        el.tagName === "rect" ||
        el.hasAttribute("data-node-id")
      ) {
        setHovered(el.getAttribute("data-node-id") || el.id || null);
      }
    };
    const handleMouseOut = () => setHovered(null);

    container.addEventListener("mouseover", handleMouseOver);
    container.addEventListener("mouseout", handleMouseOut);

    return () => {
      clearInterval(interval);
      container.removeEventListener("mouseover", handleMouseOver);
      container.removeEventListener("mouseout", handleMouseOut);
    };
  }, [containerId, refreshInterval]);

  return (
    <svg
      width="100%"
      height="100%"
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        pointerEvents: "none",
        zIndex: 9999,
      }}
    >
      {nodes.map((node) => (
        <circle
          key={node.key} // guaranteed unique
          cx={node.x}
          cy={node.y}
          r={hovered === node.id ? 8 : 5}
          fill={hovered === node.id ? "orange" : "blue"}
          stroke="white"
          strokeWidth={1}
        />
      ))}

      {nodes.map(
        (node) =>
          hovered === node.id && (
            <text
              key={`${node.key}-label`} // also unique
              x={node.x + 10}
              y={node.y - 10}
              fontSize="12px"
              fill="black"
            >
              {node.id || "node"}
            </text>
          )
      )}
    </svg>
  );
};

export default GraphDebugLayer;
