import React, { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw, Merge, Loader2, Building2, ArrowRight } from "lucide-react";
import { Card, CardContent } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { Select } from "../../../components/ui/Select";
import { Badge } from "../../../components/ui/Badge";
import { EmptyState } from "../../../components/ui/EmptyState";
import { useToast } from "../../../components/ui/Toast";
import { RankingImportAPI } from "../../../lib/rankingImportApi";

// Clubs tab — the same club is spelled differently across meets ("Hamilton" vs
// "Hamilton Aquatics Dubai"). Short forms are arbitrary, so cleanup is manual:
// merge the duplicate INTO the club you want to keep. The merge repoints all of
// the loser's swims + swimmers and is remembered, so future imports of either
// spelling resolve to the one canonical club automatically.
export default function RankingClubsPanel() {
  const toast = useToast();
  const [clubs, setClubs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loserId, setLoserId] = useState("");
  const [winnerId, setWinnerId] = useState("");
  const [merging, setMerging] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setClubs(await RankingImportAPI.listClubs() || []);
    } catch (e) {
      console.error(e);
      toast.show("Error", "Could not load clubs.", "error");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { load(); }, [load]);

  const clubById = useMemo(() => new Map(clubs.map((c) => [c.id, c])), [clubs]);
  const options = useMemo(
    () => clubs.map((c) => ({ value: c.id, label: `${c.name} (${c.result_count ?? 0} swims)` })),
    [clubs],
  );
  // Don't offer the chosen loser as its own winner.
  const winnerOptions = useMemo(() => options.filter((o) => o.value !== loserId), [options, loserId]);

  const merge = async () => {
    const loser = clubById.get(loserId);
    const winner = clubById.get(winnerId);
    if (!loser || !winner) { toast.show("Pick two clubs", "Choose a duplicate and the club to keep.", "warning"); return; }
    if (!window.confirm(
      `Merge "${loser.name}" into "${winner.name}"?\n\n` +
      `${loser.result_count ?? 0} swim(s) and ${loser.swimmer_count ?? 0} swimmer(s) will move to "${winner.name}", ` +
      `and future imports of "${loser.name}" will resolve to it.`
    )) return;
    setMerging(true);
    try {
      await RankingImportAPI.mergeClubs(loserId, winnerId);
      toast.show("Merged", `"${loser.name}" folded into "${winner.name}".`, "success");
      setLoserId(""); setWinnerId("");
      await load();
    } catch (e) {
      console.error(e);
      toast.show("Merge failed", String(e?.message || e), "error");
    } finally {
      setMerging(false);
    }
  };

  const rename = async (clubId, name) => {
    const club = clubById.get(clubId);
    if (!club || name === club.name || !name.trim()) return;
    setClubs((prev) => prev.map((c) => (c.id === clubId ? { ...c, name } : c)));
    try {
      await RankingImportAPI.renameClub(clubId, name);
    } catch (e) {
      console.error(e);
      toast.show("Rename failed", String(e?.message || e), "error");
      load();
    }
  };

  if (!clubs.length && !loading) {
    return <EmptyState icon={Building2} title="No clubs yet" description="Clubs appear here after you approve an import. Then you can merge duplicate spellings of the same club." />;
  }

  return (
    <div className="space-y-4">
      {/* merge bar */}
      <Card>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="min-w-[220px] flex-1">
            <Select label="Merge this (duplicate)" options={options} value={loserId}
              placeholder="Select a duplicate club" onChange={(e) => setLoserId(e.target.value)} />
          </div>
          <div className="hidden sm:flex items-center pb-2 text-muted"><ArrowRight className="w-5 h-5" /></div>
          <div className="min-w-[220px] flex-1">
            <Select label="…into this (keep)" options={winnerOptions} value={winnerId}
              placeholder="Select the club to keep" onChange={(e) => setWinnerId(e.target.value)} />
          </div>
          <Button variant="primary" icon={merging ? undefined : Merge} loading={merging}
            onClick={merge} disabled={!loserId || !winnerId}>
            Merge
          </Button>
          <Button variant="ghost" size="sm" icon={RefreshCw} onClick={load}>Refresh</Button>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted"><Loader2 className="w-6 h-6 animate-spin" /></div>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-lg">
              <thead className="text-muted border-b border-border">
                <tr className="text-left">
                  <Th>Club</Th><Th>Also known as</Th><Th className="text-right">Swimmers</Th><Th className="text-right">Swims</Th>
                </tr>
              </thead>
              <tbody>
                {clubs.map((c) => (
                  <tr key={c.id} className="border-b border-border/50">
                    <Td><ClubName value={c.name} onSave={(v) => rename(c.id, v)} /></Td>
                    <Td>
                      {Array.isArray(c.aliases) && c.aliases.length ? (
                        <div className="flex flex-wrap gap-1">
                          {c.aliases.map((a) => <Badge key={a} variant="muted">{a}</Badge>)}
                        </div>
                      ) : <span className="text-muted">—</span>}
                    </Td>
                    <Td className="text-right text-main">{c.swimmer_count ?? 0}</Td>
                    <Td className="text-right text-main">{c.result_count ?? 0}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <p className="text-sm text-muted">
        Tip: merge the duplicate <b>into</b> the fuller name you want to keep. Swim counts help you spot the
        canonical club. Merges are remembered, so the next import won&apos;t re-create the duplicate.
      </p>
    </div>
  );
}

function Th({ children, className = "" }) { return <th className={`px-3 py-2 font-medium whitespace-nowrap ${className}`}>{children}</th>; }
function Td({ children, className = "" }) { return <td className={`px-3 py-2 align-middle ${className}`}>{children}</td>; }

// Click-to-edit club name, commits on blur / Enter.
function ClubName({ value, onSave }) {
  const [v, setV] = useState(value ?? "");
  useEffect(() => { setV(value ?? ""); }, [value]);
  return (
    <input
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => onSave(v)}
      onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
      className="w-56 bg-transparent border border-transparent hover:border-border focus:border-primary-500 focus:bg-base rounded px-2 py-1 text-main font-medium outline-none transition-colors"
    />
  );
}
