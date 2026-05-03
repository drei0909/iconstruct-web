// src/components/ui/SearchBar.jsx
export default function SearchBar({
  value = "",
  onChange,
  placeholder = "Search...",
  accentColor = "#3B82F6",
  width = 220,
  style = {},
  disabled = false,
}) {
  const handleClear = () => {
    onChange?.({ target: { value: "" } });
  };

  return (
    <div style={{ position: "relative", width, flexShrink: 0, ...style }}>
      {/* Search icon */}
      <span
        style={{
          position: "absolute",
          left: 10,
          top: "50%",
          transform: "translateY(-50%)",
          color: "#A8B8C8",
          fontSize: 13,
          pointerEvents: "none",
          userSelect: "none",
          lineHeight: 1,
        }}
      >
        
      </span>

      <input
        type="text"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        aria-label={placeholder}
        style={{
          width: "100%",
          paddingLeft: 34,
          paddingRight: value ? 30 : 12,
          paddingTop: 8,
          paddingBottom: 8,
          fontSize: 13,
          fontFamily: "''Inter'', var(--font-base)",
          color: "#0F172A",
          background: "#fff",
          border: "1.5px solid #E2E8F0",
          borderRadius: 8,
          outline: "none",
          boxSizing: "border-box",
          opacity: disabled ? 0.6 : 1,
          cursor: disabled ? "not-allowed" : "text",
          transition: "border-color 0.15s",
        }}
        onFocus={e => {
          if (!disabled) e.target.style.borderColor = accentColor;
        }}
        onBlur={e => {
          e.target.style.borderColor = "#E2E8F0";
        }}
      />

      {/* Clear button */}
      {value && !disabled && (
        <button
          onClick={handleClear}
          aria-label="Clear search"
          style={{
            position: "absolute",
            right: 8,
            top: "50%",
            transform: "translateY(-50%)",
            background: "none",
            border: "none",
            color: "#94A3B8",
            fontSize: 16,
            lineHeight: 1,
            padding: "2px 4px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          ×
        </button>
      )}
    </div>
  );
}