"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

export type RollOption = { roll: string; name: string };

type Props = {
  options: RollOption[];
  name: string;
  defaultValue?: string;
};

/** Searchable dropdown: filter by name or roll no., submits the roll via a hidden input. */
export default function RollSelect({ options, name, defaultValue }: Props) {
  const listId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const [selected, setSelected] = useState<RollOption | undefined>(() =>
    options.find((o) => o.roll === defaultValue),
  );
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.name.toLowerCase().includes(q) || o.roll.toLowerCase().includes(q));
  }, [options, query]);

  // Close when clicking outside.
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  // Keep the highlighted option in view while using the arrow keys.
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  function choose(o: RollOption) {
    setSelected(o);
    setQuery("");
    setOpen(false);
    inputRef.current?.blur();
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && open) {
      e.preventDefault();
      if (filtered[active]) choose(filtered[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  const display = open ? query : selected ? label(selected) : "";

  return (
    <div className="combo" ref={wrapRef}>
      <input type="hidden" name={name} value={selected?.roll ?? ""} />
      <div className={`combo-field${open ? " open" : ""}`}>
        <input
          ref={inputRef}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          autoComplete="off"
          placeholder={selected ? label(selected) : "Search by name or roll no."}
          value={display}
          onFocus={() => {
            setOpen(true);
            setActive(0);
          }}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setActive(0);
          }}
          onKeyDown={onKeyDown}
        />
        <button
          type="button"
          className="combo-caret"
          tabIndex={-1}
          aria-label="Show list"
          onClick={() => {
            if (open) setOpen(false);
            else inputRef.current?.focus();
          }}
        >
          ▾
        </button>
      </div>
      {open && (
        <ul className="combo-list" id={listId} role="listbox" ref={listRef}>
          {filtered.length === 0 && <li className="combo-empty">No match found</li>}
          {filtered.map((o, i) => (
            <li
              key={o.roll}
              role="option"
              data-index={i}
              aria-selected={selected?.roll === o.roll}
              className={`combo-option${i === active ? " active" : ""}${o.roll === "others" ? " others" : ""}`}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => {
                e.preventDefault();
                choose(o);
              }}
            >
              <span className="combo-name">{o.name}</span>
              {o.roll !== "others" && <span className="combo-roll mono">{o.roll}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function label(o: RollOption) {
  return o.roll === "others" ? "Others" : `${o.roll} · ${o.name}`;
}
