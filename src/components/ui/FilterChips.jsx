
/**
 * @param {object} props
 */
export default function FilterChips({
  options     = [],
  active,
  onSelect,
  accentColor = "#1A2332",
  labelMap    = {},
  counts      = {},
  style       = {},
}) {
  return (
    <div
      style={{
        display   : "flex",
        gap       : 6,
        flexWrap  : "wrap",
        alignItems: "center",
        ...style,
      }}
    >
      {options.map(opt => {
        const isActive = active === opt;

        // Label: use labelMap override, or auto-capitalise (treating "all" → "All")
        const label =
          labelMap[opt] ??
          (opt === "all"
            ? "All"
            : opt.charAt(0).toUpperCase() + opt.slice(1));

        const count = counts[opt];

        return (
          <button
            key     = {opt}
            onClick = {() => onSelect(opt)}
            style   = {{
              display      : "inline-flex",
              alignItems   : "center",
              gap          : 5,
              padding      : "6px 12px",
              borderRadius : 20,
              border       : `1px solid ${isActive ? accentColor : "#E4E9F0"}`,
              background   : isActive ? accentColor : "transparent",
              color        : isActive ? "#fff" : "#6B7F96",
              fontSize     : 11.5,
              fontWeight   : 600,
              fontFamily   : "var(--font-base)",
              cursor       : "pointer",
              transition   : "all 0.15s",
              whiteSpace   : "nowrap",
            }}
          >
            {label}

            {/* Count badge — only rendered when count is provided */}
            {count !== undefined && (
              <span
                style={{
                  fontSize    : 10,
                  fontWeight  : 700,
                  background  : isActive ? "rgba(255,255,255,0.22)" : "#F1F5F9",
                  color       : isActive ? "#fff" : "#6B7F96",
                  borderRadius: 99,
                  padding     : "1px 6px",
                  lineHeight  : "16px",
                }}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}