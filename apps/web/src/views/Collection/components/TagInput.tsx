"use client";

/**
 * TagInput.tsx — tag entry with live recommendations.
 *
 * Typing filters the tags the locker already uses, best match first, and a
 * click (or Enter on the highlighted row) adds it. Pasting a handful of commas
 * is still the fast path for a brand-new vocabulary.
 *
 * The suggestion list is rendered inside the field's own relative box and the
 * rows swallow `mousedown`, so a click lands before the input blurs.
 */

import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Tag, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface TagInputProps {
  tags: readonly string[];
  /** Every tag already in use, for recommendations. */
  suggestions: readonly string[];
  placeholder: string;
  onAdd: (tag: string) => void;
  onRemove: (tag: string) => void;
}

const MAX_SUGGESTIONS = 6;

export function TagInput({ tags, suggestions, placeholder, onAdd, onRemove }: TagInputProps) {
  const { t } = useTranslation("collection");
  const [value, setValue] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const matches = useMemo(() => {
    const term = value.trim().toLowerCase();
    const taken = new Set(tags.map((tag) => tag.toLowerCase()));
    return suggestions
      .filter((tag) => !taken.has(tag.toLowerCase()))
      .map((tag) => ({ tag, lower: tag.toLowerCase() }))
      .filter((entry) => !term || entry.lower.includes(term))
      .sort((a, b) => {
        const aStarts = a.lower.startsWith(term) ? 0 : 1;
        const bStarts = b.lower.startsWith(term) ? 0 : 1;
        if (aStarts !== bStarts) return aStarts - bStarts;
        return a.lower.localeCompare(b.lower);
      })
      .slice(0, MAX_SUGGESTIONS)
      .map((entry) => entry.tag);
  }, [suggestions, tags, value]);

  const commit = (raw: string) => {
    const tag = raw.trim().replace(/,+$/, "");
    setValue("");
    setHighlight(0);
    if (tag) onAdd(tag);
  };

  const pick = (tag: string) => {
    commit(tag);
    inputRef.current?.focus();
  };

  const listOpen = open && matches.length > 0;

  return (
    <div className="relative">
      <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-line px-2 py-1.5">
        {tags.map((tag) => (
          <Badge key={tag} variant="secondary" className="gap-1 rounded-full text-[0.68rem] font-normal">
            {tag}
            <button type="button" aria-label={tag} onClick={() => onRemove(tag)}>
              <X className="size-3" />
            </button>
          </Badge>
        ))}
        <input
          ref={inputRef}
          value={value}
          placeholder={placeholder}
          role="combobox"
          aria-expanded={listOpen}
          aria-controls="collection-tag-suggestions"
          aria-autocomplete="list"
          onChange={(event) => {
            setValue(event.target.value);
            setOpen(true);
            setHighlight(0);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown" && matches.length > 0) {
              event.preventDefault();
              setOpen(true);
              setHighlight((index) => (index + 1) % matches.length);
            } else if (event.key === "ArrowUp" && matches.length > 0) {
              event.preventDefault();
              setOpen(true);
              setHighlight((index) => (index - 1 + matches.length) % matches.length);
            } else if (event.key === "Enter") {
              event.preventDefault();
              if (listOpen && matches[highlight]) pick(matches[highlight]);
              else commit(value);
            } else if (event.key === ",") {
              event.preventDefault();
              commit(value);
            } else if (event.key === "Escape" && listOpen) {
              event.preventDefault();
              setOpen(false);
            } else if (event.key === "Backspace" && !value && tags.length > 0) {
              onRemove(tags[tags.length - 1]);
            }
          }}
          className="min-w-[8rem] flex-1 bg-transparent text-[0.8rem] text-ink outline-none placeholder:text-ink-3"
        />
      </div>

      {listOpen ? (
        <ul
          id="collection-tag-suggestions"
          role="listbox"
          aria-label={t("editor.tagsSuggestions")}
          className="absolute left-0 right-0 top-[calc(100%+0.25rem)] z-20 max-h-44 overflow-y-auto rounded-md border border-line bg-surface p-1 shadow-lg"
        >
          {matches.map((tag, index) => (
            <li key={tag} role="option" aria-selected={index === highlight}>
              <button
                type="button"
                // Keep focus in the input so the click is not eaten by blur.
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setHighlight(index)}
                onClick={() => pick(tag)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-sm px-2 py-1 text-left text-[0.78rem] transition-colors",
                  index === highlight ? "bg-surface-2 text-ink" : "text-ink-2 hover:bg-surface-2/70",
                )}
              >
                <Tag className="size-3 shrink-0 text-ink-3" />
                <span className="truncate">{tag}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
