import { useEffect, useRef, useState } from "react";

// The "Filters" button and the menus it opens, shared by Explore and the
// brand's Campaigns page so they behave the same way. Written in the app's dark
// palette like everything else; the light look is applied on top.

// The button. Tapping it shows or hides the filter menus. The number is how
// many filters are on, so a hidden filter can't be forgotten about.
export function FilterToggle({ open, count, onToggle }: { open: boolean; count: number; onToggle: () => void }) {
  return (
    <div
      role="button"
      tabIndex={0}
      aria-expanded={open}
      onClick={onToggle}
      onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onToggle(); } }}
      style={{ display: "flex", alignItems: "center", gap: "6px", padding: "7px 4px", fontSize: "13px", fontWeight: 600, color: open || count > 0 ? "#fff" : "#999", cursor: "pointer" }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
        <path d="M4 7h10M18 7h2M4 17h2M10 17h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <circle cx="16" cy="7" r="2" stroke="currentColor" strokeWidth="2" />
        <circle cx="8" cy="17" r="2" stroke="currentColor" strokeWidth="2" />
      </svg>
      Filters{count > 0 ? ` (${count})` : ""}
    </div>
  );
}

export interface FilterSpec {
  key: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder: string;
}

const ROW = { padding: "10px 14px", fontSize: "13px", cursor: "pointer", borderBottom: "1px solid #1a1a1a" } as const;

// The row of menus. Only one is open at a time. Tapping anywhere else closes
// it without also pressing whatever was underneath. A long list scrolls inside
// its own menu, and opens already scrolled to what is picked.
export function FilterPanel({ filters }: { filters: FilterSpec[] }) {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!openKey) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpenKey(null); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [openKey]);

  // Open on the picked option, not at the top of a long list.
  useEffect(() => {
    const menu = menuRef.current;
    const picked = menu?.querySelector<HTMLElement>("[aria-selected='true']");
    if (menu && picked) menu.scrollTop = picked.offsetTop - menu.clientHeight / 2 + picked.offsetHeight / 2;
  }, [openKey]);

  return (
    <div style={{ display: "flex", gap: "8px" }}>
      {openKey && (
        // Sits behind the menus and above the page: the tap that closes a menu
        // lands here, not on a campaign underneath.
        <div onClick={() => setOpenKey(null)} style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 1 }} />
      )}
      {filters.map((f, i) => {
        const open = openKey === f.key;
        const last = i === filters.length - 1 && filters.length > 1;
        return (
          <div key={f.key} style={{ position: "relative", zIndex: 2, flex: 1, minWidth: 0 }}>
            <div
              role="button"
              tabIndex={0}
              aria-haspopup="listbox"
              aria-expanded={open}
              onClick={() => setOpenKey(open ? null : f.key)}
              onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpenKey(open ? null : f.key); } }}
              style={{ background: "#111", border: "1px solid #222", borderRadius: "8px", padding: "10px 14px", color: f.value ? "#fff" : "#555", fontSize: "13px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "6px" }}
            >
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.value || f.placeholder}</span>
              <span style={{ color: "#888", fontSize: "10px", flexShrink: 0 }}>{open ? "▲" : "▼"}</span>
            </div>
            {open && (
              <div
                ref={menuRef}
                role="listbox"
                style={{
                  position: "absolute", top: "calc(100% + 6px)", ...(last ? { right: 0 } : { left: 0 }),
                  minWidth: "100%", width: "max-content", maxWidth: "min(240px, 70vw)",
                  maxHeight: "280px", overflowY: "auto", overscrollBehavior: "contain", WebkitOverflowScrolling: "touch",
                  background: "#111", border: "1px solid #222", borderRadius: "8px", zIndex: 100,
                }}
              >
                <div
                  role="option"
                  aria-selected={!f.value}
                  onClick={() => { f.onChange(""); setOpenKey(null); }}
                  style={{ ...ROW, color: !f.value ? "#fff" : "#555", background: !f.value ? "#1a1a1a" : "transparent" }}
                >
                  {f.placeholder}
                </div>
                {f.options.map(o => (
                  <div
                    key={o}
                    role="option"
                    aria-selected={f.value === o}
                    onClick={() => { f.onChange(o); setOpenKey(null); }}
                    style={{ ...ROW, color: f.value === o ? "#fff" : "#555", background: f.value === o ? "#1a1a1a" : "transparent" }}
                  >
                    {o}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
