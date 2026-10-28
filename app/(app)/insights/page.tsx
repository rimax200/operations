import Link from "next/link";
import { cookies } from "next/headers";
import { LockIcon } from "lucide-react";
import { DemoSwitch } from "@/components/insights/demo-switch";
import { GapsPanel } from "@/components/insights/gaps-panel";
import { LoginForm } from "@/components/insights/login-form";
import { getPasscode, SESSION_COOKIE, verifySessionToken } from "@/lib/insights-auth";
import { buildInsights } from "@/lib/insights";
import { demoEventLogger, readEvents } from "@/lib/log";
import { getManualSections } from "@/lib/manual";
import { cn } from "@/lib/utils";

export const metadata = { title: "Insights" };

const DAY_MS = 24 * 60 * 60 * 1000;
// Nigeria is UTC+1 all year, so days and times are shown in Lagos time.
const LAGOS_OFFSET_MINUTES = 60;
const RANGES = [
  { id: "7", label: "7 days", days: 7 },
  { id: "30", label: "30 days", days: 30 },
  { id: "all", label: "All", days: null },
] as const;

const percent = (value: number | null) => (value === null ? "—" : `${Math.round(value * 100)}%`);
const duration = (ms: number | null) => (ms === null ? "—" : ms >= 1000 ? `${(ms / 1000).toFixed(1)} s` : `${Math.round(ms)} ms`);
const stamp = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Lagos" }).format(new Date(iso));
const dayLabel = (date: string) => `${date.slice(8, 10)}/${date.slice(5, 7)}`;

function Panel({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-card p-4 md:p-5">
      <h2 className="text-base font-semibold tracking-tight">{title}</h2>
      {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

const Empty = ({ children }: { children: React.ReactNode }) => (
  <p className="py-8 text-center text-sm text-muted-foreground">{children}</p>
);

function Kpi({ label, value, hint }: { label: string; value: string; hint?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export default async function InsightsPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const passcode = getPasscode();
  if (!passcode) {
    return (
      <div className="flex h-full items-center justify-center px-4">
        <div className="max-w-sm space-y-3 rounded-xl border border-border bg-card p-6 text-center">
          <div className="mx-auto flex size-10 items-center justify-center rounded-full bg-secondary">
            <LockIcon className="size-4 text-muted-foreground" />
          </div>
          <h1 className="text-lg font-semibold tracking-tight">Set INSIGHTS_PASSCODE to enable Insights</h1>
          <p className="text-sm text-muted-foreground">
            Add a passcode as <code className="rounded bg-muted px-1 py-0.5 text-xs">INSIGHTS_PASSCODE</code> in{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">.env.local</code>, then restart the server.
          </p>
        </div>
      </div>
    );
  }

  const cookieStore = await cookies();
  if (!verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value, passcode)) return <LoginForm />;

  // Everything below runs on the server; only finished numbers reach the browser.
  const params = await searchParams;
  const range = RANGES.find((r) => r.id === params.range) ?? RANGES[1];
  const demo = params.demo === "1";
  const now = new Date();
  const since = range.days === null ? undefined : new Date(now.getTime() - range.days * DAY_MS);

  const events = await (demo ? demoEventLogger : { readEvents }).readEvents({ since });
  const categories = new Map(getManualSections().map((s) => [s.title, s.category]));
  const insights = buildInsights(events, {
    from: since,
    to: now,
    tzOffsetMinutes: LAGOS_OFFSET_MINUTES,
    categoryOf: (title) => categories.get(title),
  });
  const { totals, responseTime, satisfaction, questionsPerDay, topTopics, gaps, flaggedAnswers } = insights;

  const maxDay = Math.max(1, ...questionsPerDay.map((d) => d.count));
  const maxTopic = Math.max(1, ...topTopics.topics.map((t) => t.count));
  const labelEvery = Math.ceil(questionsPerDay.length / 10);

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-6xl space-y-5 px-4 py-6 md:px-8 md:py-8">
        {demo && (
          <div
            role="status"
            className="rounded-lg border border-amber-300 bg-amber-100 px-4 py-3 md:mr-14 text-center text-sm font-semibold tracking-wide text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-200"
          >
            DEMO DATA, not real usage
          </div>
        )}

        <header className="flex flex-wrap items-end justify-between gap-4 md:pr-24">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">Insights</h1>
            <p className="text-sm text-muted-foreground">
              {range.days === null ? "All time" : `Last ${range.days} days`} · {events.length} logged events
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <nav aria-label="Date range" className="inline-flex rounded-lg border border-border bg-muted/50 p-0.5">
              {RANGES.map((r) => (
                <Link
                  key={r.id}
                  href={`/insights?range=${r.id}${demo ? "&demo=1" : ""}`}
                  aria-current={r.id === range.id ? "page" : undefined}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-sm transition-colors",
                    r.id === range.id ? "bg-background font-medium text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {r.label}
                </Link>
              ))}
            </nav>
            <DemoSwitch checked={demo} range={range.id} />
          </div>
        </header>

        {demo && events.length === 0 && (
          <p className="rounded-lg border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
            No demo data found. Run <code className="rounded bg-muted px-1 py-0.5 text-xs">pnpm seed:demo</code> to create it.
          </p>
        )}

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <Kpi label="Questions" value={String(totals.questions)} hint={totals.greetings > 0 ? `${totals.greetings} greetings not counted` : undefined} />
          <Kpi label="Answer rate" value={percent(totals.answerRate)} hint={`${totals.answered} answered, ${totals.fallbacks} not in manual`} />
          <Kpi
            label="Avg response time"
            value={duration(responseTime.p50)}
            hint={<>p50 · p95 <span className="tabular-nums">{duration(responseTime.p95)}</span></>}
          />
          <Kpi label="Instant answers" value={percent(totals.cacheHitRate)} hint={`${totals.cached} served from cache`} />
          <Kpi
            label="Staff rating"
            value={percent(satisfaction.upRate)}
            hint={satisfaction.up + satisfaction.down === 0 ? "No ratings yet" : `${satisfaction.up} up, ${satisfaction.down} down`}
          />
        </div>

        <div className="grid items-start gap-5 lg:grid-cols-2">
          <Panel title="Questions per day">
            {totals.questions === 0 ? (
              <Empty>No questions in this period yet.</Empty>
            ) : (
              <div
                role="img"
                aria-label={`Questions per day: ${questionsPerDay.map((d) => `${d.date} ${d.count}`).join(", ")}`}
                className="flex h-48 items-end gap-1"
              >
                {questionsPerDay.map((d, i) => (
                  <div key={d.date} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1" title={`${d.date}: ${d.count}`}>
                    <span className="text-[10px] tabular-nums text-muted-foreground">{d.count > 0 ? d.count : ""}</span>
                    <div className="w-full rounded-t bg-primary" style={{ height: `${(d.count / maxDay) * 80}%`, minHeight: d.count > 0 ? 2 : 0 }} />
                    <span className="h-3 text-[10px] text-muted-foreground">{i % labelEvery === 0 ? dayLabel(d.date) : ""}</span>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <Panel title="Most asked topics" description="Manual sections used to answer questions.">
            {topTopics.topics.length === 0 ? (
              <Empty>No answered questions in this period yet.</Empty>
            ) : (
              <>
                <ul className="space-y-2.5">
                  {topTopics.topics.map((t) => (
                    <li key={t.title} className="space-y-1">
                      <div className="flex items-baseline justify-between gap-3 text-sm">
                        <span className="min-w-0 truncate">
                          {t.title}
                          {t.category && <span className="ml-2 text-xs text-muted-foreground">{t.category}</span>}
                        </span>
                        <span className="tabular-nums text-muted-foreground">{t.count}</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted">
                        <div className="h-2 rounded-full bg-primary" style={{ width: `${(t.count / maxTopic) * 100}%` }} />
                      </div>
                    </li>
                  ))}
                </ul>
                {topTopics.categories.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-1.5 border-t border-border pt-3">
                    {topTopics.categories.map((c) => (
                      <span key={c.category} className="rounded-full bg-secondary px-2.5 py-1 text-xs text-secondary-foreground">
                        {c.category} · {c.count}
                      </span>
                    ))}
                  </div>
                )}
              </>
            )}
          </Panel>
        </div>

        <GapsPanel
          rows={gaps.map((g) => ({ question: g.question, count: g.count, lastAskedLabel: stamp(g.lastAsked), lastAskedIso: g.lastAsked }))}
        />

        <Panel title="Answers flagged by staff" description="Answers that got a thumbs down.">
          {flaggedAnswers.length === 0 ? (
            <Empty>No flagged answers in this period.</Empty>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="py-2 pr-3 font-medium">Question</th>
                    <th className="px-3 py-2 font-medium">Section used</th>
                    <th className="px-3 py-2 font-medium">Reason</th>
                    <th className="py-2 pl-3 text-right font-medium">When</th>
                  </tr>
                </thead>
                <tbody>
                  {flaggedAnswers.map((f) => (
                    <tr key={f.messageId} className="border-b border-border/60 align-top last:border-0">
                      <td className="py-2.5 pr-3">{f.question}</td>
                      <td className="px-3 py-2.5 text-muted-foreground">{f.sources.length > 0 ? f.sources.join(", ") : "None (not in manual)"}</td>
                      <td className="px-3 py-2.5">
                        {f.reason ? <span className="rounded-full bg-secondary px-2.5 py-1 text-xs text-secondary-foreground">{f.reason}</span> : <span className="text-muted-foreground">No reason given</span>}
                      </td>
                      <td className="whitespace-nowrap py-2.5 pl-3 text-right text-muted-foreground">{stamp(f.ts)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
