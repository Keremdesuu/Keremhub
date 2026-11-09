"use client";

import { useOptimistic, useState, useTransition } from "react";
import { createShelf, setRating, setStatus, toggleShelf } from "@/app/takip/actions";
import { STATUSES, type Status } from "@/lib/tracking-shared";
import { IconCheck, IconPlus, IconShelf, IconStar } from "./icons";

type Props = {
  bookId: number;
  status: Status | null;
  rating: number | null;
  shelves: { id: number; name: string }[];
  shelfIds: number[];
};

export default function TrackingPanel({ bookId, status, rating, shelves, shelfIds }: Props) {
  const [pending, start] = useTransition();
  const [optStatus, setOptStatus] = useOptimistic<Status | null, Status | null>(status, (_, n) => n);
  const [optRating, setOptRating] = useOptimistic<number, number>(rating ?? 0, (_, n) => n);
  const [optShelves, setOptShelves] = useOptimistic<number[], { id: number; on: boolean }>(shelfIds, (cur, { id, on }) =>
    on ? [...cur, id] : cur.filter((x) => x !== id)
  );
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <section aria-label="Takip" className="mt-8 max-w-2xl rounded-xl border border-line bg-surface/50 p-5">
      <h2 className="text-sm font-semibold">Takip</h2>

      <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Okuma durumu">
        {STATUSES.map((s) => {
          const on = optStatus === s.key;
          return (
            <button
              key={s.key}
              type="button"
              aria-pressed={on}
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const next = on ? null : s.key;
                  setOptStatus(next);
                  await setStatus(bookId, next);
                })
              }
              className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                on ? "border-signal bg-signal text-ink" : "border-line hover:border-signal"
              }`}
            >
              {on && <IconCheck size={16} />}
              {s.label}
            </button>
          );
        })}
      </div>

      <div className="mt-5 flex items-center gap-3">
        <span className="text-sm text-muted">Puanın</span>
        <div className="flex" role="radiogroup" aria-label="Puan">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={optRating === n}
              aria-label={`${n} yıldız`}
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const next = optRating === n ? 0 : n;
                  setOptRating(next);
                  if (next && !optStatus) setOptStatus("read");
                  await setRating(bookId, next);
                })
              }
              className={`p-1 transition-colors ${n <= optRating ? "text-amber" : "text-line hover:text-amber/60"}`}
            >
              <IconStar size={24} filled={n <= optRating} />
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5">
        <h3 className="flex items-center gap-2 text-sm text-muted">
          <IconShelf size={18} /> Raflarım
        </h3>
        <ul className="mt-2 flex flex-wrap gap-2">
          {shelves.map((sh) => {
            const on = optShelves.includes(sh.id);
            return (
              <li key={sh.id}>
                <button
                  type="button"
                  aria-pressed={on}
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      setOptShelves({ id: sh.id, on: !on });
                      await toggleShelf(bookId, sh.id, !on);
                    })
                  }
                  className={`rounded-full border px-3 py-1 text-sm ${
                    on ? "border-amber bg-amber/15 text-amber" : "border-line text-fg/85 hover:border-signal"
                  }`}
                >
                  {sh.name}
                </button>
              </li>
            );
          })}
        </ul>

        <form
          className="mt-3 flex max-w-sm gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const name = newName;
            start(async () => {
              const r = await createShelf(name);
              if ("error" in r && r.error) return setError(r.error);
              setError(null);
              setNewName("");
              if ("id" in r && r.id) await toggleShelf(bookId, r.id, true);
            });
          }}
        >
          <label className="flex-1">
            <span className="sr-only">Yeni raf adı</span>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              maxLength={40}
              placeholder="Yeni raf (ör. Favoriler)"
              className="w-full rounded-lg border border-line bg-ink px-3 py-2 text-sm placeholder:text-muted/80 focus:border-signal focus:outline-none"
            />
          </label>
          <button type="submit" disabled={pending || !newName.trim()} className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 text-sm hover:border-signal disabled:opacity-50">
            <IconPlus size={16} /> Ekle
          </button>
        </form>
        {error && (
          <p role="alert" className="mt-2 text-sm text-amber">
            {error}
          </p>
        )}
      </div>
    </section>
  );
}
