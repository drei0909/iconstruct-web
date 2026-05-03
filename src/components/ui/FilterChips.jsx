// src/components/ui/FilterChips.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Shared filter chip / tab row used by ALL dashboards and Admin panel.
//
// Works for:
//   • Status filters — "all" | "pending" | "approved" | "rejected"
//   • Category filters — "All" | "Cement" | "Tiles" | "Paint" ...
//   • Plan filters — "all" | "pro" | "business"
//
// Props
// ─────
//   options      {string[]}   Array of filter key values.
//                             e.g. ["all", "pending", "approved", "rejected"]
//
//   active       {string}     Currently active key — from useFilter's activeFilter.
//
//   onSelect     {Function}   (value: string) => void — pass useFilter's setFilter.
//
//   accentColor  {string}     Active chip fill colour (default "#1A2332").
//                             Pass your dashboard's plan colour for consistency.
//
//   labelMap     {object}     Optional display overrides.
//                             e.g. { all: "All Applications", pending: "Awaiting Review" }
//                             Keys not in labelMap auto-capitalise.
//
//   counts       {object}     Optional count badges per option.
//                             e.g. { pending: 4, approved: 12 }
//                             Pass only the counts you want to show.
//
//   style        {object}     Extra wrapper styles.
// ─────────────────────────────────────────────────────────────────────────────

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