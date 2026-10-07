"use client";

import { useMemo, useState, useTransition } from "react";
import { addNote, deleteNote, updateNote } from "./notes-actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Pencil, Trash2, X, Check, Notebook, FileText, Tag } from "lucide-react";
import { cn } from "@/lib/utils";

type Note = {
  id: string;
  symbol: string | null;
  body: string;
  createdAt: Date;
  updatedAt: Date;
};

type Filter = "ALL" | "PORTFOLIO" | { symbol: string };

export function NotesPanel({
  portfolioId,
  notes,
}: {
  portfolioId: string;
  notes: Note[];
}) {
  const [filter, setFilter] = useState<Filter>("ALL");
  const [mode, setMode] = useState<"PORTFOLIO" | "STOCK">("PORTFOLIO");
  const [body, setBody] = useState("");
  const [symbol, setSymbol] = useState("");
  const [pending, startTransition] = useTransition();

  const symbols = useMemo(() => {
    const s = new Set<string>();
    for (const n of notes) if (n.symbol) s.add(n.symbol);
    return Array.from(s).sort();
  }, [notes]);

  const portfolioCount = notes.filter((n) => !n.symbol).length;

  const filtered = useMemo(() => {
    if (filter === "ALL") return notes;
    if (filter === "PORTFOLIO") return notes.filter((n) => !n.symbol);
    return notes.filter((n) => n.symbol === filter.symbol);
  }, [notes, filter]);

  const isFilterActive = (f: Filter) => {
    if (typeof filter === "string" && typeof f === "string") return filter === f;
    if (typeof filter === "object" && typeof f === "object")
      return filter.symbol === f.symbol;
    return false;
  };

  return (
    <div className="grid gap-4 md:gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      {/* Notes list */}
      <div className="space-y-4 min-w-0">
        {/* Filter chips — swipeable row on mobile, wrap on desktop */}
        <div className="-mx-1 px-1 flex flex-nowrap lg:flex-wrap gap-2 items-center overflow-x-auto lg:overflow-visible">
          <FilterChip
            active={isFilterActive("ALL")}
            onClick={() => setFilter("ALL")}
            icon={<FileText className="h-3 w-3" />}
            label="All"
            count={notes.length}
          />
          <FilterChip
            active={isFilterActive("PORTFOLIO")}
            onClick={() => setFilter("PORTFOLIO")}
            icon={<Notebook className="h-3 w-3" />}
            label="Portfolio"
            count={portfolioCount}
          />
          {symbols.length > 0 && (
            <div className="h-4 w-px bg-white/10 mx-1" />
          )}
          {symbols.map((s) => (
            <FilterChip
              key={s}
              active={isFilterActive({ symbol: s })}
              onClick={() => setFilter({ symbol: s })}
              icon={<Tag className="h-3 w-3" />}
              label={s}
              count={notes.filter((n) => n.symbol === s).length}
              tone="primary"
            />
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/[0.08] bg-card/40 p-6 md:p-10 flex flex-col items-center justify-center text-center">
            <Notebook className="h-6 w-6 text-muted-foreground mb-3" />
            <h3 className="text-sm font-medium">
              {filter === "ALL"
                ? "No notes yet"
                : filter === "PORTFOLIO"
                  ? "No portfolio-level notes yet"
                  : `No notes for ${(filter as { symbol: string }).symbol} yet`}
            </h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm">
              Use the composer below — leave the ticker blank for portfolio-level
              thoughts, or tag it to a stock.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((n) => (
              <NoteRow key={n.id} note={n} portfolioId={portfolioId} />
            ))}
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="rounded-xl border border-white/[0.06] bg-card p-4 h-fit lg:sticky lg:top-4 min-w-0">
        <div className="label-caps mb-3">New Note</div>

        {/* Mode toggle */}
        <div className="flex gap-1 p-0.5 mb-3 rounded-md border border-white/[0.06] bg-background/40">
          {(
            [
              { key: "PORTFOLIO", label: "Portfolio", icon: Notebook },
              { key: "STOCK", label: "Stock", icon: Tag },
            ] as const
          ).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                setMode(key);
                if (key === "PORTFOLIO") setSymbol("");
              }}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded text-xs transition-colors",
                mode === key
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="h-3 w-3" />
              {label}
            </button>
          ))}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!body.trim()) return;
            if (mode === "STOCK" && !symbol.trim()) {
              toast.error("Enter a ticker for a stock note");
              return;
            }
            startTransition(async () => {
              try {
                await addNote(
                  portfolioId,
                  body,
                  mode === "STOCK" ? symbol : null,
                );
                setBody("");
                if (mode === "STOCK") setSymbol("");
                toast.success("Note added");
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "Failed");
              }
            });
          }}
          className="space-y-3"
        >
          {mode === "STOCK" && (
            <div className="space-y-1.5">
              <Label
                htmlFor="note-symbol"
                className="text-xs text-muted-foreground"
              >
                Ticker
              </Label>
              <Input
                id="note-symbol"
                placeholder="AAPL, RELIANCE.NS…"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                className="uppercase"
                autoFocus
              />
            </div>
          )}
          <div className="space-y-1.5">
            <Label
              htmlFor="note-body"
              className="text-xs text-muted-foreground"
            >
              {mode === "PORTFOLIO" ? "Note" : "Why this stock?"}
            </Label>
            <Textarea
              id="note-body"
              placeholder={
                mode === "PORTFOLIO"
                  ? "Overall thesis, allocation plan, lessons…"
                  : "Entry reason, price target, exit plan, catalysts…"
              }
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={6}
              required
            />
          </div>
          <Button
            type="submit"
            className="w-full"
            disabled={pending || !body.trim()}
          >
            {pending ? "Saving…" : `Add ${mode === "PORTFOLIO" ? "portfolio" : "stock"} note`}
          </Button>
        </form>
      </div>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  icon,
  label,
  count,
  tone = "muted",
}: {
  active: boolean;
  onClick: () => void;
  icon?: React.ReactNode;
  label: string;
  count: number;
  tone?: "muted" | "primary";
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs transition-colors border",
        active
          ? tone === "primary"
            ? "bg-primary/15 text-primary border-primary/30"
            : "bg-white/10 text-foreground border-white/10"
          : "bg-transparent text-muted-foreground border-white/[0.06] hover:text-foreground hover:bg-white/[0.03]",
      )}
    >
      {icon}
      <span>{label}</span>
      <span
        className={cn(
          "ml-0.5 text-[10px] tabular-nums px-1 rounded",
          active
            ? tone === "primary"
              ? "bg-primary/20"
              : "bg-white/10"
            : "bg-white/[0.04]",
        )}
      >
        {count}
      </span>
    </button>
  );
}

function NoteRow({ note, portfolioId }: { note: Note; portfolioId: string }) {
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(note.body);
  const [symbol, setSymbol] = useState(note.symbol ?? "");
  const [mode, setMode] = useState<"PORTFOLIO" | "STOCK">(
    note.symbol ? "STOCK" : "PORTFOLIO",
  );
  const [pending, startTransition] = useTransition();

  if (editing) {
    return (
      <div className="rounded-xl border border-primary/30 bg-card p-4 space-y-3">
        <div className="flex gap-1 p-0.5 rounded-md border border-white/[0.06] bg-background/40 w-fit">
          {(
            [
              { key: "PORTFOLIO", label: "Portfolio" },
              { key: "STOCK", label: "Stock" },
            ] as const
          ).map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                setMode(key);
                if (key === "PORTFOLIO") setSymbol("");
              }}
              className={cn(
                "px-3 py-1 rounded text-xs transition-colors",
                mode === key
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        {mode === "STOCK" && (
          <Input
            value={symbol}
            onChange={(e) => setSymbol(e.target.value.toUpperCase())}
            placeholder="Ticker (e.g. RELIANCE.NS)"
            className="uppercase"
          />
        )}
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={5}
        />
        <div className="flex justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setEditing(false);
              setBody(note.body);
              setSymbol(note.symbol ?? "");
              setMode(note.symbol ? "STOCK" : "PORTFOLIO");
            }}
            disabled={pending}
          >
            <X className="h-4 w-4 mr-1" />
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={
              pending ||
              !body.trim() ||
              (mode === "STOCK" && !symbol.trim())
            }
            onClick={() =>
              startTransition(async () => {
                try {
                  await updateNote(
                    note.id,
                    portfolioId,
                    body,
                    mode === "STOCK" ? symbol : null,
                  );
                  setEditing(false);
                  toast.success("Note updated");
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Failed");
                }
              })
            }
          >
            <Check className="h-4 w-4 mr-1" />
            Save
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-white/[0.06] bg-card p-4 group">
      <div className="flex items-start justify-between gap-2 md:gap-3 min-w-0">
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          {note.symbol ? (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold tracking-wider rounded bg-primary/10 text-primary border border-primary/20">
              <Tag className="h-2.5 w-2.5" />
              {note.symbol}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium tracking-wider rounded bg-white/5 text-muted-foreground border border-white/5">
              <Notebook className="h-2.5 w-2.5" />
              PORTFOLIO
            </span>
          )}
          <span className="text-[11px] text-muted-foreground num">
            {formatDate(note.createdAt)}
            {+note.updatedAt !== +note.createdAt && (
              <span className="ml-1 italic">· edited</span>
            )}
          </span>
        </div>
        {/* Always visible on touch; only hover-reveal on desktop with hover capability */}
        <div className="flex shrink-0 opacity-100 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setEditing(true)}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7">
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this note?</AlertDialogTitle>
                <AlertDialogDescription>
                  This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  disabled={pending}
                  onClick={(e) => {
                    e.preventDefault();
                    startTransition(async () => {
                      try {
                        await deleteNote(note.id, portfolioId);
                        toast.success("Note deleted");
                      } catch (err) {
                        toast.error(
                          err instanceof Error ? err.message : "Failed",
                        );
                      }
                    });
                  }}
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
      <p className="text-sm mt-2 whitespace-pre-wrap leading-relaxed">
        {note.body}
      </p>
    </div>
  );
}

function formatDate(d: Date) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}
