import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Users, Loader2, RefreshCw, Search, BadgeCheck, ShieldQuestion, Save, Trophy, History, Merge, ArrowRight } from "lucide-react";
import { Card, CardContent } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { Select } from "../../../components/ui/Select";
import { Input } from "../../../components/ui/Input";
import { Badge } from "../../../components/ui/Badge";
import { EmptyState } from "../../../components/ui/EmptyState";
import { SearchableSelect } from "../../../components/ui/SearchableSelect";
import Modal from "../../../components/ui/Modal";
import { useToast } from "../../../components/ui/Toast";
import { RankingAPI } from "../../../lib/rankingApi";

// Swimmers tab — the persistent registry. Search/list every swimmer with their
// club and tallies; open one to see personal bests + full swim history and fix
// their name / gender / verified flag. Matching keys off name+gender, so fixing
// a swimmer here also cleans up how future imports resolve them.
const GENDER_LABEL = { F: "Girls", M: "Boys" };
const VERIFIED_OPTS = [
  { value: "", label: "All swimmers" },
  { value: "yes", label: "Verified only" },
  { value: "no", label: "Unverified only" },
];

const eventLabel = (r) =>
  `${GENDER_LABEL[r.gender] || r.gender || ""} ${r.age_at_swim} · ${r.distance}m ${r.course_type} ${r.stroke}`.trim();

export default function RankingSwimmersPanel() {
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [allSwimmers, setAllSwimmers] = useState([]);   // unfiltered, for the merge pickers
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [verified, setVerified] = useState("");
  const [openSwimmer, setOpenSwimmer] = useState(null);
  const [loserId, setLoserId] = useState("");
  const [winnerId, setWinnerId] = useState("");
  const [merging, setMerging] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await RankingAPI.listSwimmers({ search, verified }) || []);
    } catch (e) {
      console.error(e);
      toast.show("Error", "Could not load swimmers. Run the Phase 5 view SQL if this persists.", "error");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, verified]);

  // Debounce the search box; reload immediately on the verified filter.
  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  // The full roster for the merge pickers, loaded once (and after each merge),
  // independent of the table's search/verified filters.
  const loadAll = useCallback(async () => {
    try {
      setAllSwimmers(await RankingAPI.listSwimmers({}) || []);
    } catch (e) {
      console.error(e);
    }
  }, []);
  useEffect(() => { loadAll(); }, [loadAll]);

  const total = rows.length;

  const swimmerById = useMemo(() => new Map(allSwimmers.map((s) => [s.id, s])), [allSwimmers]);
  const mergeOptions = useMemo(
    () => allSwimmers.map((s) => ({ value: s.id, label: `${s.full_name} (${s.gender || "?"}) · ${s.result_count ?? 0} swims` })),
    [allSwimmers],
  );
  const winnerOptions = useMemo(() => mergeOptions.filter((o) => o.value !== loserId), [mergeOptions, loserId]);

  const merge = async () => {
    const loser = swimmerById.get(loserId);
    const winner = swimmerById.get(winnerId);
    if (!loser || !winner) { toast.show("Pick two swimmers", "Choose the duplicate and the one to keep.", "warning"); return; }
    if (!window.confirm(
      `Merge "${loser.full_name}" into "${winner.full_name}"?\n\n` +
      `${loser.result_count ?? 0} swim(s) move to "${winner.full_name}", and future imports of ` +
      `"${loser.full_name}" will resolve to it.`
    )) return;
    setMerging(true);
    try {
      await RankingAPI.mergeSwimmers(loserId, winnerId);
      toast.show("Merged", `"${loser.full_name}" folded into "${winner.full_name}".`, "success");
      setLoserId(""); setWinnerId("");
      await Promise.all([load(), loadAll()]);
    } catch (e) {
      console.error(e);
      toast.show("Merge failed", String(e?.message || e), "error");
    } finally {
      setMerging(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* merge duplicates */}
      <Card>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="min-w-[240px] flex-1">
            <SearchableSelect label="Merge this (duplicate)" options={mergeOptions} value={loserId}
              placeholder="Search a duplicate swimmer" onChange={(e) => setLoserId(e.target.value)} />
          </div>
          <div className="hidden sm:flex items-center pb-2 text-muted"><ArrowRight className="w-5 h-5" /></div>
          <div className="min-w-[240px] flex-1">
            <SearchableSelect label="…into this (keep)" options={winnerOptions} value={winnerId}
              placeholder="Search the swimmer to keep" onChange={(e) => setWinnerId(e.target.value)} />
          </div>
          <Button variant="primary" icon={merging ? undefined : Merge} loading={merging}
            onClick={merge} disabled={!loserId || !winnerId}>Merge</Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="min-w-[240px] flex-1">
            <Input label="Search swimmer" icon={Search} placeholder="Name…" value={search}
              onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="min-w-[180px]">
            <Select label="Show" options={VERIFIED_OPTS} value={verified} onChange={(e) => setVerified(e.target.value)} />
          </div>
          <Button variant="ghost" size="sm" icon={RefreshCw} onClick={load}>Refresh</Button>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted"><Loader2 className="w-6 h-6 animate-spin" /></div>
      ) : !total ? (
        <EmptyState icon={Users} title="No swimmers"
          description={search || verified ? "No swimmers match your filter." : "Swimmers appear here after you approve an import."} />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-lg">
              <thead className="text-muted border-b border-border">
                <tr className="text-left">
                  <Th>Swimmer</Th><Th>G</Th><Th>Club</Th>
                  <Th className="text-right">Events</Th><Th className="text-right">Meets</Th><Th className="text-right">Swims</Th>
                  <Th>Last swim</Th><Th></Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((s) => (
                  <tr key={s.id} className="border-b border-border/50 hover:bg-primary-500/5 cursor-pointer"
                    onClick={() => setOpenSwimmer(s)}>
                    <Td className="text-main font-medium">{s.full_name}</Td>
                    <Td>{s.gender ? <Badge variant="muted">{s.gender}</Badge> : <span className="text-muted">—</span>}</Td>
                    <Td className="text-muted">{s.club_name || "—"}</Td>
                    <Td className="text-right text-main">{s.event_count ?? 0}</Td>
                    <Td className="text-right text-main">{s.meet_count ?? 0}</Td>
                    <Td className="text-right text-main">{s.result_count ?? 0}</Td>
                    <Td className="text-muted">{s.last_swim_date || "—"}</Td>
                    <Td>
                      {s.is_verified
                        ? <Badge variant="success">verified</Badge>
                        : <Badge variant="muted">unverified</Badge>}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <p className="text-sm text-muted">
        {total} swimmer{total === 1 ? "" : "s"} · click a row to view their profile. Same person listed twice?
        Use the merge bar above — swims move to the kept swimmer and future imports of the duplicate resolve to it.
      </p>

      <Modal isOpen={!!openSwimmer} onClose={() => setOpenSwimmer(null)} title="Swimmer profile" size="full">
        {openSwimmer && <SwimmerProfile swimmer={openSwimmer} onSaved={() => { load(); loadAll(); }} />}
      </Modal>
    </div>
  );
}

// --- profile: header edits + personal bests + full history ---
function SwimmerProfile({ swimmer, onSaved }) {
  const swimmerId = swimmer.id;
  const toast = useToast();
  const [bests, setBests] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState(swimmer.full_name || "");
  const [gender, setGender] = useState(swimmer.gender || "");
  const [verified, setVerified] = useState(!!swimmer.is_verified);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const [b, h] = await Promise.all([
          RankingAPI.getSwimmerBests(swimmerId),
          RankingAPI.getSwimmerHistory(swimmerId),
        ]);
        if (!alive) return;
        setBests(b || []);
        setHistory(h || []);
      } catch (e) {
        console.error(e);
        toast.show("Error", "Could not load this swimmer's profile.", "error");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [swimmerId]);

  const bestClub = useMemo(
    () => swimmer.club_name || bests[0]?.club_name || history[0]?.ranking_clubs?.name || "—",
    [swimmer, bests, history],
  );

  const save = async (patch) => {
    setSaving(true);
    try {
      await RankingAPI.updateSwimmer(swimmerId, patch);
      toast.show("Saved", "Swimmer updated.", "success");
      onSaved?.();
    } catch (e) {
      console.error(e);
      toast.show("Save failed", String(e?.message || e), "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-16 text-muted"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  }

  return (
    <div className="p-6 space-y-6">
      {/* editable header */}
      <div className="grid gap-3 sm:grid-cols-[1fr,auto,auto] sm:items-end">
        <Input label="Name" value={name} onChange={(e) => setName(e.target.value)}
          onBlur={() => { if (name.trim() && name.trim() !== (swimmer.full_name || "")) save({ full_name: name }); }} />
        <div className="min-w-[120px]">
          <Select label="Gender" value={gender}
            options={[{ value: "F", label: "Girls (F)" }, { value: "M", label: "Boys (M)" }]}
            placeholder="—" onChange={(e) => { setGender(e.target.value); save({ gender: e.target.value }); }} />
        </div>
        <Button variant={verified ? "success" : "outline"} icon={verified ? BadgeCheck : ShieldQuestion}
          loading={saving} onClick={() => { const v = !verified; setVerified(v); save({ is_verified: v }); }}>
          {verified ? "Verified" : "Mark verified"}
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-3 text-lg text-muted">
        <span>Club: <span className="text-main">{bestClub}</span></span>
        <span>· {bests.length} event{bests.length === 1 ? "" : "s"}</span>
        <span>· {history.length} swim{history.length === 1 ? "" : "s"}</span>
      </div>

      {/* personal bests */}
      <section className="space-y-2">
        <h3 className="flex items-center gap-2 text-lg font-semibold text-main"><Trophy className="w-4 h-4 text-primary-500" /> Personal bests</h3>
        {!bests.length ? (
          <p className="text-muted text-lg">No ranked results yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-lg">
              <thead className="text-muted border-b border-border">
                <tr className="text-left"><Th>Event</Th><Th className="text-right">Best time</Th><Th className="text-right">Rank</Th><Th className="text-right">WA pts</Th></tr>
              </thead>
              <tbody>
                {bests.map((r) => (
                  <tr key={r.best_result_id} className="border-b border-border/50">
                    <Td className="text-main">{eventLabel(r)}</Td>
                    <Td className="text-right text-main font-mono">{r.best_time_display}</Td>
                    <Td className="text-right">{r.rank_position <= 3 ? <Badge variant={r.rank_position === 1 ? "success" : "muted"}>{r.rank_position}</Badge> : <span className="text-muted">{r.rank_position}</span>}</Td>
                    <Td className="text-right text-main">{r.wa_points ?? "—"}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* full history */}
      <section className="space-y-2">
        <h3 className="flex items-center gap-2 text-lg font-semibold text-main"><History className="w-4 h-4 text-primary-500" /> Full history</h3>
        {!history.length ? (
          <p className="text-muted text-lg">No swims recorded.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-lg">
              <thead className="text-muted border-b border-border">
                <tr className="text-left"><Th>Date</Th><Th>Meet</Th><Th>Event</Th><Th className="text-right">Time</Th><Th className="text-right">Place</Th></tr>
              </thead>
              <tbody>
                {history.map((r) => (
                  <tr key={r.id} className="border-b border-border/50">
                    <Td className="text-muted whitespace-nowrap">{r.swim_date || "—"}</Td>
                    <Td className="text-muted truncate max-w-[220px]" title={r.ranking_meets?.name || ""}>{r.ranking_meets?.name || "—"}</Td>
                    <Td className="text-main">{eventLabel(r)}</Td>
                    <Td className="text-right text-main font-mono">{r.time_display}</Td>
                    <Td className="text-right text-muted">{r.finish_position ?? "—"}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="text-sm text-muted flex items-center gap-1">
        <Save className="w-3.5 h-3.5" /> Name and gender save on change; matching uses them, so corrections here also fix future imports.
      </p>
    </div>
  );
}

function Th({ children, className = "" }) { return <th className={`px-3 py-2 font-medium whitespace-nowrap ${className}`}>{children}</th>; }
function Td({ children, className = "", title }) { return <td className={`px-3 py-2 align-middle ${className}`} title={title}>{children}</td>; }
