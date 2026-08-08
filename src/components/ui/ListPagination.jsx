// Shared list pagination (Projects / Quotations)
import { useEffect } from "react";

/**
 * @param {{ page: number, pageSize: number, total: number, onPageChange: (p:number)=>void, pageSizeOptions?: number[], onPageSizeChange?: (n:number)=>void }} props
 */
export default function ListPagination({
  page,
  pageSize,
  total,
  onPageChange,
  pageSizeOptions = [5, 10, 20],
  onPageSizeChange,
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize) || 1);
  const safePage = Math.min(Math.max(1, page), totalPages);
  const from = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const to = Math.min(safePage * pageSize, total);

  useEffect(() => {
    if (safePage !== page) onPageChange(safePage);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only clamp page when totals change
  }, [safePage, page]);

  if (total === 0) return null;

  const btn = (disabled) => ({
    padding: "7px 12px",
    borderRadius: 8,
    border: "1.5px solid #E2E8F0",
    background: disabled ? "#F8FAFC" : "#fff",
    color: disabled ? "#CBD5E1" : "#334155",
    fontSize: 12,
    fontWeight: 600,
    cursor: disabled ? "not-allowed" : "pointer",
    fontFamily: "inherit",
  });

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        marginTop: 16,
        padding: "12px 4px 4px",
        borderTop: "1px solid #F1F5F9",
      }}
    >
      <div style={{ fontSize: 12, color: "#64748B" }}>
        Showing <strong style={{ color: "#0F172A" }}>{from}–{to}</strong> of{" "}
        <strong style={{ color: "#0F172A" }}>{total}</strong>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
        {onPageSizeChange && (
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#64748B" }}>
            Per page
            <select
              value={pageSize}
              onChange={(e) => {
                onPageSizeChange(Number(e.target.value));
                onPageChange(1);
              }}
              style={{
                padding: "6px 8px",
                borderRadius: 8,
                border: "1.5px solid #E2E8F0",
                fontSize: 12,
                fontWeight: 600,
                color: "#334155",
                background: "#fff",
              }}
            >
              {pageSizeOptions.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </label>
        )}

        <button
          type="button"
          disabled={safePage <= 1}
          onClick={() => onPageChange(safePage - 1)}
          style={btn(safePage <= 1)}
        >
          ← Prev
        </button>
        <span style={{ fontSize: 12, fontWeight: 700, color: "#0F172A", minWidth: 72, textAlign: "center" }}>
          Page {safePage} / {totalPages}
        </span>
        <button
          type="button"
          disabled={safePage >= totalPages}
          onClick={() => onPageChange(safePage + 1)}
          style={btn(safePage >= totalPages)}
        >
          Next →
        </button>
      </div>
    </div>
  );
}

export function paginate(items, page, pageSize) {
  const list = Array.isArray(items) ? items : [];
  const totalPages = Math.max(1, Math.ceil(list.length / pageSize) || 1);
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;
  return {
    page: safePage,
    totalPages,
    slice: list.slice(start, start + pageSize),
    total: list.length,
  };
}
