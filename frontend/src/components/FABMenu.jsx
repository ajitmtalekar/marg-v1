export default function FABMenu({
  isOpen,
  onToggle,
  disabled,
  onUseLocation,
  onScan,
  onVoice,
  onSimulate,
  onLanguage,
  onExhibits,
  languageLabel,
  onNavIcon,
  voiceActive
}) {
  return (
    <div
      className="fab-wrapper"
      onClick={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
    >

      {/* MAIN FAB BUTTON */}
      <button
        className="fab-main"
        onClick={(e) => {
          e.stopPropagation();
          if (!disabled) onToggle();
        }}
      >
        {isOpen ? "✖" : "➕"}
      </button>

      {/* Render items ONLY when open */}
      {isOpen && !disabled && (
        <div className="fab-list open">

          <button
            className="fab-btn"
            onClick={(e) => {
              e.stopPropagation();
              onUseLocation?.();
            }}
          >
            📍
            <span className="fab-label">My Location</span>
          </button>

          <button
            className="fab-btn"
            onClick={(e) => {
              e.stopPropagation();
              onScan?.();
            }}
          >
            🔍
            <span className="fab-label">Scan QR</span>
          </button>

          <button
            className={`fab-btn voice-btn ${voiceActive ? "on" : "off"}`}
            onClick={(e) => {
              e.stopPropagation();
              onVoice?.();
            }}
          >
            {voiceActive ? "🎤" : "🔇"}
            <span className="fab-label">
              {voiceActive ? "Voice On" : "Voice Off"}
            </span>
          </button>

          <button
            className="fab-btn"
            onClick={(e) => {
              e.stopPropagation();
              onSimulate?.();
            }}
          >
            🚶
            <span className="fab-label">Simulate Walk</span>
          </button>

          <button
            className="fab-btn"
            onClick={(e) => {
              e.stopPropagation();
              onExhibits?.(e);
            }}
          >
            🐾
            <span className="fab-label">Exhibits</span>
          </button>

          <button
            className="fab-btn"
            onClick={(e) => {
              e.stopPropagation();
              onLanguage?.();
            }}
          >
            🌐
            <span className="fab-label">{languageLabel}</span>
          </button>

          <button
            className="fab-btn"
            onClick={(e) => {
              e.stopPropagation();
              onNavIcon?.();
            }}
          >
            🧭
            <span className="fab-label">Nav Icon</span>
          </button>

        </div>
      )}
    </div>
  );
}
