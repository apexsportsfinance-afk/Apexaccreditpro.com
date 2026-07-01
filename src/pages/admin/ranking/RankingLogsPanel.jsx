import React, { useCallback, useEffect, useState } from "react";
import { ScrollText, Loader2, RefreshCw, ChevronRight, Undo2, XCircle, FileText, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { Badge } from "../../../components/ui/Badge";
import { EmptyState } from "../../../components/ui/EmptyState";
import { useToast } from "../../../components/ui/Toast";
import { RankingImportAPI } from "../../../lib/rankingImportApi";

// Import Logs tab — the audit trail for every upload. Each batch shows its
// status, tallies (imported / matched / needing review / errors / duplicates),
// and expands to its files (page count + parse status + error). Approved and
// awaiting batches can be reversed/deleted here too, so this doubles as the
// place to undo a bad import without hunting through the Review tab.
const STATUS_TONE = { review: "warning", approved: "success", reversed: "muted", extracting: "info" };

export default function RankingLogsPanel() {
  const toast = useToast();
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const [files, setFiles] = useState({});          // batchId -> files[]
  const [filesLoading, setFilesLoading] = useState(null);
  const [acting, setActing] = useState(null);       // batchId being reversed/deleted

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setBatches(await RankingImportAPI.listBatches() || []);
    } catch (e) {
      console.error(e);
      toast.show("Error", "Could not load import logs.", "error");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggle = async (batchId) => {
    if (expanded === batchId) { setExpanded(null); return; }
    setExpanded(batchId);
    if (!files[batchId]) {
      setFilesLoading(batchId);
      try {
        const f = await RankingImportAPI.getBatchFiles(batchId);
        setFiles((prev) => ({ ...prev, [batchId]: f || [] }));
      } catch (e) {
        console.error(e);
        toast.show("Error", "Could not load this batch's files.", "error");
      } finally {
        setFilesLoading(null);
      }
    }
  };

  const reverse = async (b) => {
    if (!window.confirm("Reverse this batch? Its published results are removed from the ranking (re-rankable later).")) return;
    setActing(b.id);
    try {
      const { deleted } = await RankingImportAPI.reverseBatch(b.id);
      toast.show("Reversed", `${deleted} result(s) removed from the ranking.`, "success");
      await load();
    } catch (e) {
      console.error(e);
      toast.show("Reverse failed", String(e?.message || e), "error");
    } finally {
      setActing(null);
    }
  };

  const remove = async (b) => {
    if (!window.confirm(
      `Delete this batch entirely?\n\nIts staged rows${b.status === "approved" ? " AND published results" : ""} ` +
      `are removed and its PDF(s) can be re-imported. This cannot be undone.`
    )) return;
    setActing(b.id);
    try {
      await RankingImportAPI.deleteBatch(b.id);
      toast.show("Deleted", "Batch removed. Its files can be re-imported.", "success");
      setExpanded(null);
      await load();
    } catch (e) {
      console.error(e);
      toast.show("Delete failed", String(e?.message || e), "error");
    } finally {
      setActing(null);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-16 text-muted"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  }
  if (!batches.length) {
    return <EmptyState icon={ScrollText} title="No imports yet" description="Every upload is logged here with its parse status, tallies and files." />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-lg text-muted">{batches.length} import{batches.length === 1 ? "" : "s"}</p>
        <Button variant="ghost" size="sm" icon={RefreshCw} onClick={load}>Refresh</Button>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-lg">
            <thead className="text-muted border-b border-border">
              <tr className="text-left">
                <Th></Th><Th>Uploaded</Th><Th>Meet</Th><Th>Course</Th><Th>Status</Th>
                <Th className="text-right">Rows</Th><Th className="text-right">Matched</Th><Th className="text-right">Review</Th>
                <Th className="text-right">Errors</Th><Th className="text-right">Dupes</Th><Th></Th>
              </tr>
            </thead>
            <tbody>
              {batches.map((b) => {
                const open = expanded === b.id;
                const busy = acting === b.id;
                return (
                  <React.Fragment key={b.id}>
                    <tr className="border-b border-border/50 hover:bg-primary-500/5 cursor-pointer" onClick={() => toggle(b.id)}>
                      <Td><ChevronRight className={`w-4 h-4 text-muted transition-transform ${open ? "rotate-90" : ""}`} /></Td>
                      <Td className="text-muted whitespace-nowrap">{fmtDate(b.uploaded_at)}</Td>
                      <Td className="text-main truncate max-w-[220px]" title={b.ranking_meets?.name || ""}>{b.ranking_meets?.name || "Untitled meet"}</Td>
                      <Td className="text-muted">{b.ranking_meets?.course_type || b.course_type || "?"}</Td>
                      <Td><Badge variant={STATUS_TONE[b.status] || "muted"}>{b.status}</Badge></Td>
                      <Td className="text-right text-main">{b.results_imported ?? 0}</Td>
                      <Td className="text-right text-main">{b.swimmers_matched ?? 0}</Td>
                      <Td className="text-right text-main">{b.swimmers_needing_review ?? 0}</Td>
                      <Td className={`text-right ${b.errors_count ? "text-amber-500" : "text-muted"}`}>{b.errors_count ?? 0}</Td>
                      <Td className={`text-right ${b.duplicates_skipped ? "text-amber-500" : "text-muted"}`}>{b.duplicates_skipped ?? 0}</Td>
                      <Td onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          {b.status === "approved" && (
                            <button onClick={() => reverse(b)} disabled={busy} title="Reverse import"
                              className="text-muted hover:text-amber-400 disabled:opacity-40"><Undo2 className="w-4 h-4" /></button>
                          )}
                          <button onClick={() => remove(b)} disabled={busy} title="Delete batch"
                            className="text-muted hover:text-red-400 disabled:opacity-40"><XCircle className="w-4 h-4" /></button>
                        </div>
                      </Td>
                    </tr>
                    {open && (
                      <tr className="bg-base-alt/30">
                        <Td></Td>
                        <td colSpan={10} className="px-3 py-3">
                          {filesLoading === b.id ? (
                            <div className="flex items-center gap-2 text-muted"><Loader2 className="w-4 h-4 animate-spin" /> Loading files…</div>
                          ) : (files[b.id] || []).length === 0 ? (
                            <p className="text-muted">No files recorded for this batch.</p>
                          ) : (
                            <ul className="space-y-1">
                              {files[b.id].map((f) => (
                                <li key={f.id} className="flex items-center gap-3 text-base">
                                  <FileText className="w-4 h-4 text-primary-500 flex-shrink-0" />
                                  <span className="flex-1 truncate text-main" title={f.file_name}>{f.file_name}</span>
                                  <span className="text-muted">{f.page_count ?? "?"} pages</span>
                                  {f.parse_status === "error"
                                    ? <span className="flex items-center gap-1 text-red-400" title={f.error_detail || ""}><AlertTriangle className="w-4 h-4" /> parse error</span>
                                    : <span className="flex items-center gap-1 text-emerald-500"><CheckCircle2 className="w-4 h-4" /> ok</span>}
                                </li>
                              ))}
                            </ul>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <p className="text-sm text-muted">
        Reverse un-publishes an approved batch (keeps the audit row); delete removes the batch entirely and frees its
        PDFs so they can be re-imported. Duplicate files are skipped at upload and counted here.
      </p>
    </div>
  );
}

function fmtDate(ts) {
  if (!ts) return "—";
  try { return new Date(ts).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }); }
  catch { return String(ts); }
}
function Th({ children, className = "" }) { return <th className={`px-3 py-2 font-medium whitespace-nowrap ${className}`}>{children}</th>; }
function Td({ children, className = "", title, onClick }) { return <td className={`px-3 py-2 align-middle ${className}`} title={title} onClick={onClick}>{children}</td>; }
