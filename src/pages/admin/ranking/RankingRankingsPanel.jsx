import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Trophy, Loader2, FileSpreadsheet, FileText, FileDown, RefreshCw } from "lucide-react";
import { Card, CardContent } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { Select } from "../../../components/ui/Select";
import { Badge } from "../../../components/ui/Badge";
import { EmptyState } from "../../../components/ui/EmptyState";
import { useToast } from "../../../components/ui/Toast";
import { RankingAPI } from "../../../lib/rankingApi";
import { exportRanking, eventTitle } from "../../../lib/rankingExport";

// Rankings tab — pick one event (gender + age + stroke + distance + course) and
// see every swimmer's fastest all-time time ranked 1..N, with World Aquatics
// points. Dropdowns cascade from the events that actually have results, so you
// can only choose combinations that exist. Optional club filter narrows the rows
// while keeping each swimmer's true overall rank. Export to XLSX / CSV / PDF.
const GENDER_LABEL = { F: "Girls", M: "Boys" };
const COURSE_LABEL = { LC: "Long Course (50m)", SC: "Short Course (25m)" };

const uniq = (arr) => [...new Set(arr)];
const opt = (v, label) => ({ value: String(v), label: label ?? String(v) });

export default function RankingRankingsPanel() {
  const toast = useToast();
  const [events, setEvents] = useState([]);
  const [clubs, setClubs] = useState([]);
  const [loadingMeta, setLoadingMeta] = useState(false);

  const [f, setF] = useState({ courseType: "", gender: "", stroke: "", distance: "", age: "", clubId: "" });
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    (async () => {
      setLoadingMeta(true);
      try {
        const [ev, cl] = await Promise.all([RankingAPI.listEvents(), RankingAPI.listClubOptions()]);
        setEvents(ev || []);
        setClubs(cl || []);
      } catch (e) {
        console.error(e);
        toast.show("Error", "Could not load ranking events. Run the Phase 4 views SQL if this persists.", "error");
      } finally {
        setLoadingMeta(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cascading option lists: each level is narrowed by the selections above it.
  const match = (e, keys) =>
    (!keys.includes("courseType") || !f.courseType || e.course_type === f.courseType) &&
    (!keys.includes("gender") || !f.gender || e.gender === f.gender) &&
    (!keys.includes("stroke") || !f.stroke || e.stroke === f.stroke) &&
    (!keys.includes("distance") || !f.distance || String(e.distance) === f.distance);

  const courseOpts = useMemo(
    () => uniq(events.map((e) => e.course_type)).sort().map((c) => opt(c, COURSE_LABEL[c] || c)),
    [events],
  );
  const genderOpts = useMemo(
    () => uniq(events.filter((e) => match(e, ["courseType"])).map((e) => e.gender)).sort()
      .map((g) => opt(g, GENDER_LABEL[g] || g)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [events, f.courseType],
  );
  const strokeOpts = useMemo(
    () => uniq(events.filter((e) => match(e, ["courseType", "gender"])).map((e) => e.stroke)).sort()
      .map((s) => opt(s)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [events, f.courseType, f.gender],
  );
  const distanceOpts = useMemo(
    () => uniq(events.filter((e) => match(e, ["courseType", "gender", "stroke"])).map((e) => e.distance))
      .sort((a, b) => a - b).map((d) => opt(d, `${d}m`)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [events, f.courseType, f.gender, f.stroke],
  );
  const ageOpts = useMemo(
    () => uniq(events.filter((e) => match(e, ["courseType", "gender", "stroke", "distance"])).map((e) => e.age_at_swim))
      .sort((a, b) => a - b).map((a) => opt(a, `${a} yrs`)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [events, f.courseType, f.gender, f.stroke, f.distance],
  );
  const clubOpts = useMemo(() => clubs.map((c) => opt(c.id, c.name)), [clubs]);

  // Changing a filter clears the ones downstream of it (they may no longer be valid).
  const CASCADE = ["courseType", "gender", "stroke", "distance", "age"];
  const setFilter = (key, value) => {
    setF((prev) => {
      const next = { ...prev, [key]: value };
      const idx = CASCADE.indexOf(key);
      if (idx !== -1) for (const k of CASCADE.slice(idx + 1)) next[k] = "";
      return next;
    });
  };

  const complete = f.courseType && f.gender && f.stroke && f.distance && f.age;
  const apiFilters = useMemo(() => ({
    gender: f.gender, ageAtSwim: f.age ? parseInt(f.age, 10) : null,
    stroke: f.stroke, distance: f.distance ? parseInt(f.distance, 10) : null,
    courseType: f.courseType, clubId: f.clubId || null,
  }), [f]);

  const load = useCallback(async () => {
    if (!complete) { setRows([]); return; }
    setLoading(true);
    try {
      setRows(await RankingAPI.listRankings(apiFilters) || []);
    } catch (e) {
      console.error(e);
      toast.show("Error", String(e?.message || e), "error");
      setRows([]);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [complete, apiFilters]);

  useEffect(() => { load(); }, [load]);

  const titleFilters = { ...apiFilters };
  const doExport = async (format) => {
    if (!rows.length) return;
    setExporting(true);
    try {
      await exportRanking(format, rows, titleFilters);
    } catch (e) {
      console.error(e);
      toast.show("Export failed", String(e?.message || e), "error");
    } finally {
      setExporting(false);
    }
  };

  const hasBaseTimes = useMemo(() => rows.some((r) => r.wa_points != null), [rows]);

  if (loadingMeta) {
    return <div className="flex items-center justify-center py-16 text-muted"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  }
  if (!events.length) {
    return <EmptyState icon={Trophy} title="No ranked results yet"
      description="Approve an import first. Once results are published, choose an event here to see the ranking." />;
  }

  return (
    <div className="space-y-4">
      {/* filter bar */}
      <Card>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <Select label="Course" options={courseOpts} value={f.courseType}
              placeholder="Course" onChange={(e) => setFilter("courseType", e.target.value)} />
            <Select label="Gender" options={genderOpts} value={f.gender}
              placeholder="Gender" onChange={(e) => setFilter("gender", e.target.value)} />
            <Select label="Stroke" options={strokeOpts} value={f.stroke}
              placeholder="Stroke" onChange={(e) => setFilter("stroke", e.target.value)} />
            <Select label="Distance" options={distanceOpts} value={f.distance}
              placeholder="Distance" onChange={(e) => setFilter("distance", e.target.value)} />
            <Select label="Age" options={ageOpts} value={f.age}
              placeholder="Age" onChange={(e) => setFilter("age", e.target.value)} />
            <Select label="Club (optional)" options={clubOpts} value={f.clubId}
              placeholder="All clubs" onChange={(e) => setFilter("clubId", e.target.value)} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="ghost" size="sm" icon={RefreshCw} onClick={load} disabled={!complete}>Refresh</Button>
            <div className="flex-1" />
            <Button variant="outline" size="sm" icon={FileSpreadsheet} loading={exporting}
              onClick={() => doExport("xlsx")} disabled={!rows.length}>Excel</Button>
            <Button variant="outline" size="sm" icon={FileDown} loading={exporting}
              onClick={() => doExport("csv")} disabled={!rows.length}>CSV</Button>
            <Button variant="outline" size="sm" icon={FileText} loading={exporting}
              onClick={() => doExport("pdf")} disabled={!rows.length}>PDF</Button>
          </div>
        </CardContent>
      </Card>

      {!complete ? (
        <EmptyState icon={Trophy} title="Choose an event"
          description="Pick a course, gender, stroke, distance and age to see the ranking. Only combinations that have results are shown." />
      ) : loading ? (
        <div className="flex items-center justify-center py-16 text-muted"><Loader2 className="w-6 h-6 animate-spin" /></div>
      ) : rows.length === 0 ? (
        <EmptyState icon={Trophy} title="No swimmers"
          description="No published results match this event (and club, if set)." />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3 text-lg">
            <Badge variant="info">{eventTitle(apiFilters)}</Badge>
            <span className="text-muted">{rows.length} swimmer{rows.length === 1 ? "" : "s"}</span>
            {!hasBaseTimes && (
              <span className="text-amber-500 text-sm">WA points blank — add base times in Settings.</span>
            )}
          </div>
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-lg">
                <thead className="text-muted border-b border-border">
                  <tr className="text-left">
                    <Th className="text-right">#</Th><Th>Swimmer</Th><Th>Club</Th>
                    <Th className="text-right">Time</Th><Th className="text-right">WA Pts</Th><Th>Meet</Th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.best_result_id} className="border-b border-border/50">
                      <Td className="text-right">
                        {r.rank_position <= 3
                          ? <Badge variant={r.rank_position === 1 ? "success" : "muted"}>{r.rank_position}</Badge>
                          : <span className="text-muted">{r.rank_position}</span>}
                      </Td>
                      <Td className="text-main font-medium">{r.swimmer_name || "—"}</Td>
                      <Td className="text-muted">{r.club_name || "—"}</Td>
                      <Td className="text-right text-main font-mono">{r.best_time_display || "—"}</Td>
                      <Td className="text-right text-main">{r.wa_points ?? "—"}</Td>
                      <Td className="text-muted truncate max-w-[220px]" title={r.meet_name || ""}>{r.meet_name || "—"}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

function Th({ children, className = "" }) { return <th className={`px-3 py-2 font-medium whitespace-nowrap ${className}`}>{children}</th>; }
function Td({ children, className = "", title }) { return <td className={`px-3 py-2 align-middle ${className}`} title={title}>{children}</td>; }
