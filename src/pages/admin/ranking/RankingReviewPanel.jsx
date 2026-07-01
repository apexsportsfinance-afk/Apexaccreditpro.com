import React, { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw, CheckCircle2, Undo2, Trash2, AlertTriangle, Loader2, ClipboardCheck, XCircle } from "lucide-react";
import { Card, CardContent } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { Select } from "../../../components/ui/Select";
import { Badge } from "../../../components/ui/Badge";
import { EmptyState } from "../../../components/ui/EmptyState";
import { useToast } from "../../../components/ui/Toast";
import { RankingImportAPI } from "../../../lib/rankingImportApi";
import { parseTimeToMs, formatMs } from "../../../lib/rankingResultParser";

const STROKES = ["Freestyle", "Backstroke", "Breaststroke", "Butterfly", "Individual Medley"]
  .map((s) => ({ value: s, label: s }));
const GENDERS = [{ value: "F", label: "F" }, { value: "M", label: "M" }];

const STATUS_TONE = { review: "warning", approved: "success", reversed: "muted", extracting: "info" };

// Review tab — inspect a staged batch, correct rows, then approve (promote to the
// permanent ranking_results) or reverse (undo an approved batch's results).
export default function RankingReviewPanel({ initialBatchId }) {
  const toast = useToast();
  const [batches, setBatches] = useState([]);
  const [batchId, setBatchId] = useState(initialBatchId || "");
  const [batch, setBatch] = useState(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [acting, setActing] = useState(false);

  const loadBatches = useCallback(async () => {
    try {
      const list = await RankingImportAPI.listBatches();
      setBatches(list || []);
      // Default to the incoming batch, else the newest.
      setBatchId((cur) => cur || initialBatchId || list?.[0]?.id || "");
    } catch (e) {
      console.error(e);
      toast.show("Error", "Could not load import batches.", "error");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialBatchId]);

  const loadBatch = useCallback(async (id) => {
    if (!id) { setBatch(null); setRows([]); return; }
    setLoading(true);
    try {
      const [b, r] = await Promise.all([
        RankingImportAPI.getBatch(id),
        RankingImportAPI.getStagingRows(id),
      ]);
      setBatch(b);
      setRows(r || []);
    } catch (e) {
      console.error(e);
      toast.show("Error", "Could not load this batch.", "error");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { loadBatches(); }, [loadBatches]);
  useEffect(() => { loadBatch(batchId); }, [batchId, loadBatch]);

  const reviewCount = useMemo(() => rows.filter((r) => r.needs_review).length, [rows]);
  const status = batch?.status;

  // --- inline edit: update local state immediately, persist to Supabase. ---
  const saveRow = async (rowId, patch) => {
    setRows((prev) => prev.map((r) => (r.id === rowId ? { ...r, ...patch } : r)));
    try {
      await RankingImportAPI.updateStagingRow(rowId, patch);
    } catch (e) {
      console.error(e);
      toast.show("Save failed", "That edit didn't save — reload the batch.", "error");
    }
  };

  const editText = (row, field, value) => {
    if (value === row[field]) return;
    saveRow(row.id, { [field]: value });
  };

  // Editing a club offers to fix EVERY swimmer in the batch sharing that club —
  // "fix one club → all its athletes update automatically". Same-spelling rows only
  // (different spellings are unified later on the Clubs tab). Falls back to a single
  // row when the club is unique or the user declines the bulk apply.
  const sameClub = (a, b) => (a ?? "").trim().toLowerCase() === (b ?? "").trim().toLowerCase();
  const editClub = (row, value) => {
    const next = (value ?? "").trim();
    if (sameClub(next, row.club_name)) return;
    const peers = rows.filter((r) => sameClub(r.club_name, row.club_name));
    if (peers.length > 1 &&
        window.confirm(
          `Apply "${next || "(blank)"}" to all ${peers.length} swimmer(s) currently listed as ` +
          `"${row.club_name || "(blank)"}" in this batch?\n\nCancel to change only this one row.`
        )) {
      const ids = new Set(peers.map((r) => r.id));
      setRows((prev) => prev.map((r) => (ids.has(r.id) ? { ...r, club_name: next } : r)));
      RankingImportAPI.updateStagingClubName(batchId, row.club_name, next).catch((e) => {
        console.error(e);
        toast.show("Bulk update failed", "Those club edits didn't save — reload the batch.", "error");
        loadBatch(batchId);
      });
      return;
    }
    saveRow(row.id, { club_name: next });
  };

  const editTime = (row, value) => {
    const ms = parseTimeToMs(value);
    if (ms == null) {
      toast.show("Bad time", `"${value}" isn't a valid time (e.g. 28.91 or 2:57.71).`, "warning");
      // revert display by reloading local value
      setRows((prev) => [...prev]);
      return;
    }
    saveRow(row.id, { time_ms: ms, time_display: formatMs(ms) });
  };

  const deleteRow = async (rowId) => {
    setRows((prev) => prev.filter((r) => r.id !== rowId));
    try {
      await RankingImportAPI.deleteStagingRow(rowId);
    } catch (e) {
      console.error(e);
      toast.show("Delete failed", "Could not remove that row.", "error");
      loadBatch(batchId);
    }
  };

  const approve = async () => {
    if (!window.confirm(`Approve ${rows.length} result(s)? This publishes them to the permanent ranking.`)) return;
    setActing(true);
    try {
      const { inserted } = await RankingImportAPI.approveBatch(batchId);
      toast.show("Approved", `${inserted} result(s) published to the ranking.`, "success");
      await Promise.all([loadBatch(batchId), loadBatches()]);
    } catch (e) {
      console.error(e);
      toast.show("Approve failed", String(e?.message || e), "error");
    } finally {
      setActing(false);
    }
  };

  const reverse = async () => {
    if (!window.confirm("Reverse this batch? Its results will be removed from the ranking (re-rankable later).")) return;
    setActing(true);
    try {
      const { deleted } = await RankingImportAPI.reverseBatch(batchId);
      toast.show("Reversed", `${deleted} result(s) removed from the ranking.`, "success");
      await Promise.all([loadBatch(batchId), loadBatches()]);
    } catch (e) {
      console.error(e);
      toast.show("Reverse failed", String(e?.message || e), "error");
    } finally {
      setActing(false);
    }
  };

  const remove = async () => {
    if (!window.confirm(
      `Delete this batch entirely?\n\nIts ${rows.length} staged row(s)` +
      `${status === "approved" ? " AND its published results" : ""} will be removed, and its PDF(s) ` +
      `can be re-imported. This cannot be undone.`
    )) return;
    setActing(true);
    try {
      await RankingImportAPI.deleteBatch(batchId);
      toast.show("Deleted", "Batch removed. Its files can be re-imported.", "success");
      setBatchId("");
      setBatch(null);
      setRows([]);
      await loadBatches();
    } catch (e) {
      console.error(e);
      toast.show("Delete failed", String(e?.message || e), "error");
    } finally {
      setActing(false);
    }
  };

  const batchOptions = batches.map((b) => ({
    value: b.id,
    label: `${b.ranking_meets?.name || "Untitled meet"} · ${b.course_type || "?"} · ${b.status} · ${b.results_imported ?? 0} rows`,
  }));

  if (!batches.length && !loading) {
    return <EmptyState icon={ClipboardCheck} title="No imports yet" description="Import a result PDF first, then come back here to review and approve it." />;
  }

  return (
    <div className="space-y-4">
      {/* batch picker + actions */}
      <Card>
        <CardContent className="flex flex-wrap items-end gap-4">
          <div className="min-w-[280px] flex-1">
            <Select label="Batch" options={batchOptions} value={batchId} placeholder="Select a batch" onChange={(e) => setBatchId(e.target.value)} />
          </div>
          <Button variant="ghost" size="sm" icon={RefreshCw} onClick={() => loadBatch(batchId)}>Refresh</Button>
          {status === "review" && (
            <Button variant="success" icon={acting ? undefined : CheckCircle2} loading={acting} onClick={approve} disabled={!rows.length}>
              Approve &amp; publish
            </Button>
          )}
          {status === "approved" && (
            <Button variant="danger" icon={acting ? undefined : Undo2} loading={acting} onClick={reverse}>
              Reverse import
            </Button>
          )}
          {batchId && (
            <Button variant="ghost" size="sm" icon={XCircle} loading={acting} onClick={remove}
              className="text-red-400 hover:text-red-300" title="Delete this batch and free its files">
              Delete batch
            </Button>
          )}
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted"><Loader2 className="w-6 h-6 animate-spin" /></div>
      ) : batch ? (
        <>
          {/* meta strip */}
          <div className="flex flex-wrap items-center gap-3 text-lg">
            <Badge variant={STATUS_TONE[status] || "muted"}>{status}</Badge>
            <span className="text-main font-medium">{batch.ranking_meets?.name || "Untitled meet"}</span>
            <span className="text-muted">{batch.ranking_meets?.course_type || batch.course_type}</span>
            {batch.ranking_meets?.start_date && <span className="text-muted">· {batch.ranking_meets.start_date}</span>}
            <span className="text-muted">· {rows.length} rows</span>
            {reviewCount > 0 && (
              <span className="flex items-center gap-1 text-amber-500"><AlertTriangle className="w-4 h-4" /> {reviewCount} need review</span>
            )}
          </div>

          {status !== "review" && (
            <p className="text-sm text-muted">
              This batch is <b>{status}</b>. Editing is available on batches awaiting review.
            </p>
          )}

          {/* staging grid */}
          {rows.length === 0 ? (
            <EmptyState icon={ClipboardCheck} title="No rows" description="This batch has no staged results (all duplicates, or a parse error). Check the import summary." />
          ) : (
            <Card>
              <div className="overflow-x-auto">
                <table className="w-full text-lg">
                  <thead className="text-muted border-b border-border">
                    <tr className="text-left">
                      <Th>#</Th><Th>Swimmer</Th><Th>Club</Th><Th>G</Th><Th>Stroke</Th>
                      <Th>Dist</Th><Th>Age</Th><Th>Time</Th><Th>Match</Th><Th></Th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => {
                      const editable = status === "review";
                      return (
                        <tr key={r.id} className={`border-b border-border/50 ${r.needs_review ? "bg-amber-500/5" : ""}`}>
                          <Td className="text-muted">{r.finish_position ?? "—"}</Td>
                          <Td><CellText value={r.full_name} editable={editable} onSave={(v) => editText(r, "full_name", v)} /></Td>
                          <Td><CellText value={r.club_name} editable={editable} onSave={(v) => editClub(r, v)} /></Td>
                          <Td>
                            {editable
                              ? <MiniSelect value={r.gender || ""} options={GENDERS} onChange={(v) => editText(r, "gender", v)} />
                              : r.gender}
                          </Td>
                          <Td>
                            {editable
                              ? <MiniSelect value={r.stroke || ""} options={STROKES} onChange={(v) => editText(r, "stroke", v)} />
                              : r.stroke}
                          </Td>
                          <Td><CellText value={r.distance} width="w-16" editable={editable} onSave={(v) => editText(r, "distance", parseInt(v, 10) || null)} /></Td>
                          <Td><CellText value={r.age_at_swim} width="w-14" editable={editable} onSave={(v) => editText(r, "age_at_swim", parseInt(v, 10) || null)} /></Td>
                          <Td><CellText value={r.time_display} width="w-24" editable={editable} onSave={(v) => editTime(r, v)} /></Td>
                          <Td>
                            {r.matched_swimmer_id
                              ? <Badge variant={r.needs_review ? "warning" : "success"}>{r.match_confidence ?? "✓"}</Badge>
                              : <Badge variant="muted">new</Badge>}
                          </Td>
                          <Td>
                            {editable && (
                              <button onClick={() => deleteRow(r.id)} className="text-muted hover:text-red-400" title="Delete row">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </Td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </>
      ) : null}
    </div>
  );
}

function Th({ children }) { return <th className="px-3 py-2 font-medium whitespace-nowrap">{children}</th>; }
function Td({ children, className = "" }) { return <td className={`px-3 py-2 align-middle ${className}`}>{children}</td>; }

// Click-to-edit text cell that commits on blur / Enter.
function CellText({ value, editable, onSave, width = "w-40" }) {
  const [v, setV] = useState(value ?? "");
  useEffect(() => { setV(value ?? ""); }, [value]);
  if (!editable) return <span className="text-main">{value ?? "—"}</span>;
  return (
    <input
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => onSave(v)}
      onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
      className={`${width} bg-transparent border border-transparent hover:border-border focus:border-primary-500 focus:bg-base rounded px-2 py-1 text-main outline-none transition-colors`}
    />
  );
}

function MiniSelect({ value, options, onChange }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="bg-base border border-border rounded px-2 py-1 text-main outline-none focus:border-primary-500"
    >
      <option value="">—</option>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}
