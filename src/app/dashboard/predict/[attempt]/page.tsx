"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { formatDate } from "@/data/worldcup2026";
import { staticFallback, type ApiMatch } from "@/lib/matches";
import { clearSession, readSession, type Session } from "@/lib/session";
import type { KnockoutPick, PredictionDoc } from "@/lib/types";

const MERQUE_LOGO =
  "https://www.merquellantas.com/assets/images/logo/Logo-Merquellantas.png";

type SaveState = "idle" | "saving" | "saved" | "error";

function ScoreInput({
  value,
  onChange,
  ariaLabel,
}: {
  value: number | null | undefined;
  onChange: (v: number | null) => void;
  ariaLabel: string;
}) {
  const [text, setText] = useState<string>(
    value == null || value === undefined ? "" : String(value),
  );
  useEffect(() => {
    setText(value == null || value === undefined ? "" : String(value));
  }, [value]);
  return (
    <input
      type="number"
      inputMode="numeric"
      min={0}
      max={20}
      aria-label={ariaLabel}
      value={text}
      onChange={(e) => {
        const raw = e.target.value.replace(/[^0-9]/g, "");
        setText(raw);
        if (raw === "") {
          onChange(null);
        } else {
          const n = Number(raw);
          if (Number.isInteger(n) && n >= 0 && n <= 20) onChange(n);
        }
      }}
      className="h-12 w-14 border border-[var(--line)] bg-white text-center font-mono text-xl font-black tabular-nums outline-none transition focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20"
    />
  );
}

function GroupMatchRow({
  match,
  score,
  onSave,
}: {
  match: ApiMatch;
  score: { home: number; away: number } | undefined;
  onSave: (home: number | null, away: number | null) => void;
}) {
  return (
    <li className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 border border-[var(--line)] bg-white p-4 md:grid-cols-[120px_1fr_auto_1fr_auto]">
      <div className="hidden font-mono text-[10px] uppercase tracking-[0.28em] text-[var(--foreground-muted)] md:block">
        <div>{formatDate(match.date)}</div>
        <div className="text-[var(--foreground)]">{match.time}</div>
      </div>
      <div className="flex items-center gap-3 md:justify-end">
        <span className="text-right text-base font-bold uppercase tracking-tight">
          {match.home.name}
        </span>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={match.home.crest}
          alt=""
          aria-hidden
          className="h-9 w-12 border border-[var(--line)] object-cover"
        />
      </div>
      <div className="flex items-center gap-2">
        <ScoreInput
          value={score?.home}
          onChange={(v) =>
            onSave(v, score?.away ?? null)
          }
          ariaLabel={`${match.home.name} goles`}
        />
        <span className="font-mono text-xs font-bold text-[var(--foreground-muted)]">
          vs
        </span>
        <ScoreInput
          value={score?.away}
          onChange={(v) =>
            onSave(score?.home ?? null, v)
          }
          ariaLabel={`${match.away.name} goles`}
        />
      </div>
      <div className="flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={match.away.crest}
          alt=""
          aria-hidden
          className="h-9 w-12 border border-[var(--line)] object-cover"
        />
        <span className="text-base font-bold uppercase tracking-tight">
          {match.away.name}
        </span>
      </div>
      <div className="col-span-3 border-t border-dashed border-[var(--line)] pt-2 text-xs text-[var(--foreground-soft)] md:col-span-1 md:border-0 md:pt-0 md:text-right">
        <div className="md:hidden">
          {formatDate(match.date)} · {match.time}
        </div>
        <div className="font-medium">{match.venue}</div>
        {match.city && (
          <div className="text-[var(--foreground-muted)]">{match.city}</div>
        )}
      </div>
    </li>
  );
}

function KnockoutMatchRow({
  pick,
  onSave,
}: {
  pick: KnockoutPick;
  onSave: (
    home: number | null,
    away: number | null,
    penaltyWinner: "home" | "away" | null,
  ) => void;
}) {
  const isTie =
    pick.home != null && pick.away != null && pick.home === pick.away;
  return (
    <li className="grid gap-3 border border-[var(--line)] bg-white p-4">
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 md:grid-cols-[1fr_auto_1fr]">
        <div className="text-right text-base font-bold uppercase tracking-tight">
          {pick.homeTeamName || "—"}
        </div>
        <div className="flex items-center gap-2">
          <ScoreInput
            value={pick.home}
            onChange={(v) =>
              onSave(v, pick.away, pick.penaltyWinner)
            }
            ariaLabel={`${pick.homeTeamName} goles`}
          />
          <span className="font-mono text-xs font-bold text-[var(--foreground-muted)]">
            vs
          </span>
          <ScoreInput
            value={pick.away}
            onChange={(v) =>
              onSave(pick.home, v, pick.penaltyWinner)
            }
            ariaLabel={`${pick.awayTeamName} goles`}
          />
        </div>
        <div className="text-base font-bold uppercase tracking-tight">
          {pick.awayTeamName || "—"}
        </div>
      </div>
      {isTie && (
        <div className="flex flex-wrap items-center gap-3 border-t border-dashed border-[var(--line)] pt-3 text-sm">
          <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-[var(--foreground-muted)]">
            Gana en penales
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onSave(pick.home, pick.away, "home")}
              className={
                "border px-3 py-2 text-xs font-bold uppercase tracking-[0.18em] transition " +
                (pick.penaltyWinner === "home"
                  ? "border-[var(--brand)] bg-[var(--brand)] text-white"
                  : "border-[var(--line)] hover:border-[var(--brand)]")
              }
            >
              {pick.homeTeamName}
            </button>
            <button
              type="button"
              onClick={() => onSave(pick.home, pick.away, "away")}
              className={
                "border px-3 py-2 text-xs font-bold uppercase tracking-[0.18em] transition " +
                (pick.penaltyWinner === "away"
                  ? "border-[var(--brand)] bg-[var(--brand)] text-white"
                  : "border-[var(--line)] hover:border-[var(--brand)]")
              }
            >
              {pick.awayTeamName}
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

const STAGE_TITLES: Record<KnockoutPick["stage"], string> = {
  ROUND_OF_32: "Dieciseisavos",
  ROUND_OF_16: "Octavos",
  QUARTER_FINALS: "Cuartos",
  SEMI_FINALS: "Semifinales",
  THIRD_PLACE: "Tercer puesto",
  FINAL: "Final",
};

export default function PredictPage() {
  const router = useRouter();
  const params = useParams<{ attempt: string }>();
  const attemptNum = Number(params.attempt);

  const [session, setSession] = useState<Session | null>(null);
  const [matches, setMatches] = useState<ApiMatch[]>([]);
  const [prediction, setPrediction] = useState<PredictionDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [activeGroup, setActiveGroup] = useState<string>("A");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const s = readSession();
    if (!s) {
      router.replace("/login");
      return;
    }
    if (
      !Number.isInteger(attemptNum) ||
      attemptNum < 1 ||
      attemptNum > s.attemptsAllowed
    ) {
      router.replace("/dashboard");
      return;
    }
    setSession(s);
  }, [router, attemptNum]);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([
      fetch("/api/matches").then((r) => r.json()),
      fetch(
        `/api/predictions/${attemptNum}?email=${encodeURIComponent(session.email)}`,
      ).then((r) => r.json()),
    ])
      .then(([m, p]) => {
        if (cancelled) return;
        const arr: ApiMatch[] = Array.isArray(m.matches)
          ? m.matches
          : staticFallback();
        setMatches(arr.length ? arr : staticFallback());
        setPrediction(p.prediction);
        setError(null);
      })
      .catch(() => {
        if (cancelled) return;
        setError("No pudimos cargar tu pronóstico.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [session, attemptNum]);

  const groupMatches = useMemo(
    () => matches.filter((m) => m.stage === "GROUP_STAGE" && m.group),
    [matches],
  );
  const groupKeys = useMemo(() => {
    const set = new Set<string>();
    groupMatches.forEach((m) => m.group && set.add(m.group));
    return Array.from(set).sort();
  }, [groupMatches]);
  const matchesByGroup = useMemo(() => {
    const map: Record<string, ApiMatch[]> = {};
    groupMatches.forEach((m) => {
      if (!m.group) return;
      (map[m.group] ??= []).push(m);
    });
    Object.values(map).forEach((list) =>
      list.sort((a, b) => {
        const md = (a.matchday ?? 0) - (b.matchday ?? 0);
        if (md !== 0) return md;
        return a.date.localeCompare(b.date);
      }),
    );
    return map;
  }, [groupMatches]);

  const filledCount = prediction
    ? Object.keys(prediction.groupScores).length
    : 0;
  const totalGroupMatches = groupMatches.length;
  const groupComplete =
    totalGroupMatches > 0 && filledCount === totalGroupMatches;

  const knockoutFilled = useMemo(() => {
    if (!prediction) return 0;
    const stages = [
      prediction.knockout.r32,
      prediction.knockout.r16,
      prediction.knockout.qf,
      prediction.knockout.sf,
    ].flat();
    const extras = [prediction.knockout.third, prediction.knockout.final].filter(
      (p): p is KnockoutPick => Boolean(p),
    );
    return [...stages, ...extras].filter(
      (p) => p.home != null && p.away != null,
    ).length;
  }, [prediction]);

  const totalKnockout = 32;
  const allDone =
    groupComplete &&
    knockoutFilled === totalKnockout &&
    !!prediction?.champion;

  const saveGroupScore = useCallback(
    async (matchId: string, home: number | null, away: number | null) => {
      if (!session) return;
      if (home == null || away == null) return;
      setSaveState("saving");
      try {
        const res = await fetch(`/api/predictions/${attemptNum}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            kind: "group",
            email: session.email,
            matchId,
            home,
            away,
          }),
        });
        if (!res.ok) throw new Error(await res.text());
        const data = (await res.json()) as { prediction: PredictionDoc };
        setPrediction(data.prediction);
        setSaveState("saved");
      } catch {
        setSaveState("error");
      }
    },
    [session, attemptNum],
  );

  const saveKnockout = useCallback(
    async (
      matchId: string,
      home: number | null,
      away: number | null,
      penaltyWinner: "home" | "away" | null,
    ) => {
      if (!session) return;
      setSaveState("saving");
      try {
        const res = await fetch(`/api/predictions/${attemptNum}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            kind: "knockout",
            email: session.email,
            matchId,
            home,
            away,
            penaltyWinner,
          }),
        });
        if (!res.ok) throw new Error(await res.text());
        const data = (await res.json()) as { prediction: PredictionDoc };
        setPrediction(data.prediction);
        setSaveState("saved");
      } catch {
        setSaveState("error");
      }
    },
    [session, attemptNum],
  );

  function scheduleSaveGroup(
    matchId: string,
    home: number | null,
    away: number | null,
  ) {
    setPrediction((prev) => {
      if (!prev) return prev;
      const next = { ...prev.groupScores };
      if (home == null && away == null) {
        delete next[matchId];
      } else {
        next[matchId] = {
          home: home ?? next[matchId]?.home ?? 0,
          away: away ?? next[matchId]?.away ?? 0,
        };
      }
      return { ...prev, groupScores: next };
    });
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      if (home != null && away != null) {
        void saveGroupScore(matchId, home, away);
      }
    }, 400);
  }

  function scheduleSaveKnockout(
    matchId: string,
    home: number | null,
    away: number | null,
    penaltyWinner: "home" | "away" | null,
  ) {
    setPrediction((prev) => {
      if (!prev) return prev;
      const nextKnockout: PredictionDoc["knockout"] = {
        r32: [...prev.knockout.r32],
        r16: [...prev.knockout.r16],
        qf: [...prev.knockout.qf],
        sf: [...prev.knockout.sf],
        third: prev.knockout.third,
        final: prev.knockout.final,
      };
      const arrayStages: Array<"r32" | "r16" | "qf" | "sf"> = [
        "r32",
        "r16",
        "qf",
        "sf",
      ];
      for (const stage of arrayStages) {
        const arr = nextKnockout[stage];
        const idx = arr.findIndex((p) => p.matchId === matchId);
        if (idx >= 0) {
          arr[idx] = { ...arr[idx], home, away, penaltyWinner };
          return { ...prev, knockout: nextKnockout };
        }
      }
      if (nextKnockout.third?.matchId === matchId) {
        nextKnockout.third = {
          ...nextKnockout.third,
          home,
          away,
          penaltyWinner,
        };
        return { ...prev, knockout: nextKnockout };
      }
      if (nextKnockout.final?.matchId === matchId) {
        nextKnockout.final = {
          ...nextKnockout.final,
          home,
          away,
          penaltyWinner,
        };
        return { ...prev, knockout: nextKnockout };
      }
      return prev;
    });
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void saveKnockout(matchId, home, away, penaltyWinner);
    }, 400);
  }

  function handleLogout() {
    clearSession();
    router.replace("/login");
  }

  if (!session) {
    return (
      <main className="flex min-h-screen items-center justify-center text-sm text-[var(--foreground-muted)]">
        Cargando…
      </main>
    );
  }

  const groupMatchesForActive = matchesByGroup[activeGroup] ?? [];
  const matchdaysForActive = Array.from(
    new Set(groupMatchesForActive.map((m) => m.matchday)),
  )
    .filter((md): md is number => md != null)
    .sort();

  return (
    <div className="flex min-h-screen flex-col bg-[var(--background)] text-[var(--foreground)]">
      <header className="sticky top-0 z-30 border-b border-[var(--line)] bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/dashboard" className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={MERQUE_LOGO} alt="Merquellantas" className="h-9 w-auto" />
            <span className="hidden h-6 w-px bg-[var(--line)] sm:block" />
            <span className="hidden text-sm font-semibold tracking-wide sm:inline">
              Polla Mundialista
            </span>
          </Link>
          <div className="flex items-center gap-4">
            <span
              aria-live="polite"
              className={
                "hidden text-xs font-mono uppercase tracking-[0.28em] sm:inline " +
                (saveState === "saving"
                  ? "text-[var(--foreground-muted)]"
                  : saveState === "saved"
                    ? "text-emerald-600"
                    : saveState === "error"
                      ? "text-red-600"
                      : "text-[var(--foreground-muted)]")
              }
            >
              {saveState === "saving"
                ? "Guardando…"
                : saveState === "saved"
                  ? "Guardado"
                  : saveState === "error"
                    ? "Error al guardar"
                    : ""}
            </span>
            <button
              onClick={handleLogout}
              className="rounded-sm border border-[var(--line)] px-4 py-2 text-sm font-semibold transition hover:border-[var(--brand)] hover:text-[var(--brand)]"
            >
              Cerrar sesión
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <section className="border-b border-[var(--line)] bg-[var(--foreground)] text-white">
          <div className="mx-auto max-w-6xl px-6 py-12">
            <p className="font-mono text-[11px] uppercase tracking-[0.32em] text-[var(--brand)]">
              Boleta · Intento {attemptNum}
            </p>
            <h1 className="mt-3 text-3xl font-black uppercase leading-tight md:text-5xl">
              Llena tu pronóstico
            </h1>
            <p className="mt-3 max-w-xl text-white/70">
              Predice el marcador exacto de cada partido. Al terminar la fase de
              grupos calculamos tu llave de eliminatorias.
            </p>
            <div className="mt-6 grid max-w-md grid-cols-2 gap-6 font-mono text-[11px] uppercase tracking-[0.28em] text-white/60">
              <div>
                <dt>Fase de grupos</dt>
                <dd className="mt-1 text-2xl font-black tabular-nums text-white">
                  {filledCount}/{totalGroupMatches || "—"}
                </dd>
              </div>
              <div>
                <dt>Eliminatorias</dt>
                <dd className="mt-1 text-2xl font-black tabular-nums text-white">
                  {groupComplete ? `${knockoutFilled}/${totalKnockout}` : "—"}
                </dd>
              </div>
            </div>
          </div>
        </section>

        {loading || !prediction ? (
          <section className="mx-auto max-w-6xl px-6 py-12">
            <div className="border border-dashed border-[var(--line)] bg-white p-12 text-center text-sm text-[var(--foreground-muted)]">
              Cargando…
            </div>
          </section>
        ) : (
          <>
            {error && (
              <div className="mx-auto mt-6 max-w-6xl border-l-4 border-[var(--brand)] bg-[var(--brand-soft)] p-4 px-6 text-sm text-[var(--brand-dark)]">
                {error}
              </div>
            )}

            <section className="sticky top-[65px] z-20 border-b border-[var(--line)] bg-[var(--background)]/95 backdrop-blur">
              <div className="mx-auto max-w-6xl px-6 py-4">
                <div className="flex items-center gap-3 overflow-x-auto pb-1">
                  <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-[var(--foreground-muted)]">
                    Grupo
                  </span>
                  <div className="flex gap-2">
                    {groupKeys.map((g) => {
                      const active = g === activeGroup;
                      const groupFilled = (matchesByGroup[g] ?? []).every(
                        (m) => prediction.groupScores[m._id],
                      );
                      return (
                        <button
                          key={g}
                          type="button"
                          onClick={() => setActiveGroup(g)}
                          className={
                            "relative h-10 min-w-10 shrink-0 border px-3 font-mono text-base font-black transition " +
                            (active
                              ? "border-[var(--brand)] bg-[var(--brand)] text-white"
                              : groupFilled
                                ? "border-emerald-600 bg-emerald-50 text-emerald-700"
                                : "border-[var(--line)] bg-white text-[var(--foreground)] hover:border-[var(--brand)] hover:text-[var(--brand)]")
                          }
                        >
                          {g}
                          {groupFilled && !active && (
                            <span
                              aria-hidden
                              className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-emerald-600"
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </section>

            <section className="mx-auto max-w-6xl px-6 py-10">
              <div className="border-l-4 border-[var(--brand)] bg-white p-6">
                <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-[var(--brand)]">
                  Grupo {activeGroup}
                </p>
                <p className="mt-2 text-sm text-[var(--foreground-soft)]">
                  Llena el marcador de cada partido. Los cambios se guardan
                  automáticamente.
                </p>
              </div>
              <div className="mt-8 space-y-8">
                {matchdaysForActive.map((md) => {
                  const list = groupMatchesForActive.filter(
                    (m) => m.matchday === md,
                  );
                  if (!list.length) return null;
                  return (
                    <div key={md}>
                      <div className="mb-3 flex items-baseline justify-between border-b border-[var(--foreground)] pb-2">
                        <h2 className="font-mono text-xs font-bold uppercase tracking-[0.3em]">
                          Jornada {md}
                        </h2>
                        <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-[var(--foreground-muted)]">
                          {list[0].date ? formatDate(list[0].date) : ""}
                        </span>
                      </div>
                      <ul className="grid gap-3">
                        {list.map((m) => (
                          <GroupMatchRow
                            key={m._id}
                            match={m}
                            score={prediction.groupScores[m._id]}
                            onSave={(h, a) => scheduleSaveGroup(m._id, h, a)}
                          />
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="mx-auto max-w-6xl px-6 pb-16">
              <div className="border-t border-[var(--line)] pt-10">
                <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-[var(--foreground-muted)]">
                  Eliminatorias
                </p>
                <h2 className="mt-2 text-2xl font-black uppercase md:text-3xl">
                  {groupComplete
                    ? "Tu llave de eliminación"
                    : "Completa la fase de grupos para abrir la llave"}
                </h2>
                {!groupComplete && (
                  <p className="mt-2 text-sm text-[var(--foreground-soft)]">
                    Llevas {filledCount}/{totalGroupMatches} partidos predichos.
                  </p>
                )}
              </div>

              {groupComplete && (
                <div className="mt-8 grid gap-8">
                  {(
                    [
                      { stage: "ROUND_OF_32" as const, picks: prediction.knockout.r32 },
                      { stage: "ROUND_OF_16" as const, picks: prediction.knockout.r16 },
                      { stage: "QUARTER_FINALS" as const, picks: prediction.knockout.qf },
                      { stage: "SEMI_FINALS" as const, picks: prediction.knockout.sf },
                    ] as const
                  ).map(({ stage, picks }) => (
                    <div key={stage}>
                      <div className="mb-3 flex items-baseline justify-between border-b border-[var(--foreground)] pb-2">
                        <h3 className="font-mono text-xs font-bold uppercase tracking-[0.3em]">
                          {STAGE_TITLES[stage]}
                        </h3>
                        <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-[var(--foreground-muted)]">
                          {picks.filter((p) => p.home != null && p.away != null).length}
                          /{picks.length}
                        </span>
                      </div>
                      <ul className="grid gap-3 md:grid-cols-2">
                        {picks.map((p) => (
                          <KnockoutMatchRow
                            key={p.matchId}
                            pick={p}
                            onSave={(h, a, pw) =>
                              scheduleSaveKnockout(p.matchId, h, a, pw)
                            }
                          />
                        ))}
                      </ul>
                    </div>
                  ))}

                  <div className="grid gap-6 md:grid-cols-2">
                    {prediction.knockout.third && (
                      <div>
                        <div className="mb-3 flex items-baseline justify-between border-b border-[var(--foreground)] pb-2">
                          <h3 className="font-mono text-xs font-bold uppercase tracking-[0.3em]">
                            {STAGE_TITLES.THIRD_PLACE}
                          </h3>
                        </div>
                        <ul className="grid gap-3">
                          <KnockoutMatchRow
                            pick={prediction.knockout.third}
                            onSave={(h, a, pw) =>
                              scheduleSaveKnockout(
                                prediction.knockout.third!.matchId,
                                h,
                                a,
                                pw,
                              )
                            }
                          />
                        </ul>
                      </div>
                    )}
                    {prediction.knockout.final && (
                      <div>
                        <div className="mb-3 flex items-baseline justify-between border-b border-[var(--foreground)] pb-2">
                          <h3 className="font-mono text-xs font-bold uppercase tracking-[0.3em]">
                            {STAGE_TITLES.FINAL}
                          </h3>
                        </div>
                        <ul className="grid gap-3">
                          <KnockoutMatchRow
                            pick={prediction.knockout.final}
                            onSave={(h, a, pw) =>
                              scheduleSaveKnockout(
                                prediction.knockout.final!.matchId,
                                h,
                                a,
                                pw,
                              )
                            }
                          />
                        </ul>
                      </div>
                    )}
                  </div>

                  {prediction.champion && (
                    <div className="border-l-4 border-[var(--brand)] bg-[var(--brand-soft)] p-8">
                      <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-[var(--brand-dark)]">
                        Tu campeón pronosticado
                      </p>
                      <p className="mt-3 text-4xl font-black uppercase tracking-tight text-[var(--brand-dark)]">
                        {prediction.champion.name}
                      </p>
                    </div>
                  )}

                  {allDone && (
                    <div className="border border-emerald-600 bg-emerald-50 p-6 text-sm text-emerald-800">
                      ¡Boleta completa! Tu pronóstico se ha guardado. Puedes
                      regresar al{" "}
                      <Link href="/dashboard" className="font-bold underline">
                        panel
                      </Link>{" "}
                      o seguir ajustando hasta el primer partido.
                    </div>
                  )}
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
