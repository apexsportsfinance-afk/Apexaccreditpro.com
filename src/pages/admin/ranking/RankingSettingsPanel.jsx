import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Loader2, Gauge, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { Select } from "../../../components/ui/Select";
import { Input } from "../../../components/ui/Input";
import { Badge } from "../../../components/ui/Badge";
import { EmptyState } from "../../../components/ui/EmptyState";
import { useToast } from "../../../components/ui/Toast";
import { RankingAPI } from "../../../lib/rankingApi";
import { parseTimeToMs, formatMs } from "../../../lib/rankingResultParser";

// Settings tab — manage the World Aquatics base times (the "1000-point" time
// for each event). Points on the Rankings tab are computed from the newest
// base time matching a swim's gender/course/stroke/distance, so editing a base
// re-ranks everything automatically. Base times are versioned by year.
const GENDERS = [{ value: "F", label: "Girls (F)" }, { value: "M", label: "Boys (M)" }];
const COURSES = [{ value: "LC", label: "Long Course (50m)" }, { value: "SC", label: "Short Course (25m)" }];
const STROKES = ["Freestyle", "Backstroke", "Breaststroke", "Butterfly", "Individual Medley"]
  .map((s) => ({ value: s, label: s }));
const GENDER_LABEL = { F: "Girls", M: "Boys" };

export default function RankingSettingsPanel() {
  const toast = useToast();
  const currentYear = new Date().getFullYear();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const blank = { gender: "F", course_type: "LC", stroke: "Freestyle", distance: "", baseTime: "", year: String(currentYear) };
  const [form, setForm] = useState(blank);
  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await RankingAPI.listBaseTimes() || []);
    } catch (e) {
      console.error(e);
      toast.show("Error", "Could not load base times.", "error");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { load(); }, [load]);

  const add = async () => {
    const distance = parseInt(form.distance, 10);
    const year = parseInt(form.year, 10);
    const baseMs = parseTimeToMs(form.baseTime);
    if (!distance) { toast.show("Distance needed", "Enter a distance in metres (e.g. 50).", "warning"); return; }
    if (!year) { toast.show("Year needed", "Enter the base-time version year (e.g. 2024).", "warning"); return; }
    if (baseMs == null) { toast.show("Bad time", `"${form.baseTime}" isn't a valid time (e.g. 20.91 or 1:42.00).`, "warning"); return; }
    setSaving(true);
    try {
      await RankingAPI.upsertBaseTime({
        gender: form.gender, course_type: form.course_type, stroke: form.stroke,
        distance, base_time_ms: baseMs, year,
      });
      toast.show("Saved", `Base time for ${GENDER_LABEL[form.gender]} ${distance}m ${form.course_type} ${form.stroke} (${year}) set.`, "success");
      setForm((p) => ({ ...p, distance: "", baseTime: "" }));
      await load();
    } catch (e) {
      console.error(e);
      toast.show("Save failed", String(e?.message || e), "error");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (row) => {
    if (!window.confirm(`Delete the ${GENDER_LABEL[row.gender]} ${row.distance}m ${row.course_type} ${row.stroke} base time (${row.year})?`)) return;
    setRows((prev) => prev.filter((r) => r.id !== row.id));
    try {
      await RankingAPI.deleteBaseTime(row.id);
    } catch (e) {
      console.error(e);
      toast.show("Delete failed", String(e?.message || e), "error");
      load();
    }
  };

  const grouped = useMemo(() => rows, [rows]);

  return (
    <div className="space-y-4">
      {/* add form */}
      <Card>
        <CardHeader>
          <h2 className="text-xl font-semibold text-main flex items-center gap-2">
            <Gauge className="w-5 h-5 text-primary-500" /> World Aquatics base times
          </h2>
          <p className="text-sm text-muted">The time worth 1000 points for an event. Points = 1000 × (base ÷ swim)³.</p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 items-end">
            <Select label="Gender" options={GENDERS} value={form.gender} onChange={(e) => set("gender", e.target.value)} />
            <Select label="Course" options={COURSES} value={form.course_type} onChange={(e) => set("course_type", e.target.value)} />
            <Select label="Stroke" options={STROKES} value={form.stroke} onChange={(e) => set("stroke", e.target.value)} />
            <Input label="Distance (m)" inputMode="numeric" placeholder="50" value={form.distance}
              onChange={(e) => set("distance", e.target.value.replace(/[^0-9]/g, ""))} />
            <Input label="Base time" placeholder="20.91 or 1:42.00" value={form.baseTime}
              onChange={(e) => set("baseTime", e.target.value)} />
            <Input label="Year" inputMode="numeric" placeholder={String(currentYear)} value={form.year}
              onChange={(e) => set("year", e.target.value.replace(/[^0-9]/g, ""))} />
          </div>
          <div className="mt-3 flex items-center gap-2">
            <Button variant="primary" icon={saving ? undefined : Plus} loading={saving} onClick={add}>Add / update</Button>
            <Button variant="ghost" size="sm" icon={RefreshCw} onClick={load}>Refresh</Button>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted"><Loader2 className="w-6 h-6 animate-spin" /></div>
      ) : !grouped.length ? (
        <EmptyState icon={Gauge} title="No base times yet"
          description="Add the World Aquatics 1000-point time for each event above. Until then, WA points stay blank on the Rankings tab (the ranking itself still works — it's ordered by time)." />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-lg">
              <thead className="text-muted border-b border-border">
                <tr className="text-left">
                  <Th>Year</Th><Th>Gender</Th><Th>Course</Th><Th>Stroke</Th>
                  <Th className="text-right">Distance</Th><Th className="text-right">Base time</Th><Th></Th>
                </tr>
              </thead>
              <tbody>
                {grouped.map((r) => (
                  <tr key={r.id} className="border-b border-border/50">
                    <Td>{r.year}</Td>
                    <Td><Badge variant="muted">{GENDER_LABEL[r.gender] || r.gender}</Badge></Td>
                    <Td>{r.course_type}</Td>
                    <Td className="text-main">{r.stroke}</Td>
                    <Td className="text-right text-main">{r.distance}m</Td>
                    <Td className="text-right text-main font-mono">{formatMs(r.base_time_ms)}</Td>
                    <Td className="text-right">
                      <button onClick={() => remove(r)} className="text-muted hover:text-red-400" title="Delete base time">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <p className="text-sm text-muted">
        Tip: enter the base time exactly as World Aquatics publishes it (e.g. Men 50 Free LCM = 20.91).
        The newest matching <b>year</b> is used, so adding next year&apos;s table re-points every ranking automatically.
      </p>
    </div>
  );
}

function Th({ children, className = "" }) { return <th className={`px-3 py-2 font-medium whitespace-nowrap ${className}`}>{children}</th>; }
function Td({ children, className = "" }) { return <td className={`px-3 py-2 align-middle ${className}`}>{children}</td>; }
