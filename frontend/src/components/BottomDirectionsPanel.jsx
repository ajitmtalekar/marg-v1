import React from "react";
import "./bottom-directions.css";

export default function BottomDirectionsPanel({
  directions,
  currentStep,
  onStepClick
}) {
  return (
    <div className="dir-bottom-panel">
      <div className="dir-header">
        <div>
          <strong>{directions[currentStep]?.instruction}</strong>
        </div>
        <div className="dir-distance">
          {directions[currentStep]?.distance} m
        </div>
      </div>

      <div className="dir-scroll">
        {directions.map((step, i) => (
          <div
            key={i}
            className={`dir-step ${i === currentStep ? "active" : ""}`}
            onClick={() => onStepClick(i)}
          >
            <div className="step-title">
  {step.instruction?.trim()
    ? step.instruction
    : `Walk ${Math.round(step.distance)} meters`}
</div>

           <div className="step-distance">{Math.round(step.distance)} m</div>

          </div>
        ))}
      </div>
    </div>
  );
}
