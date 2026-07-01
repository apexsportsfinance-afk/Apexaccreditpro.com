import React, { useMemo, useRef, useState } from "react";
import { Upload, FileText, X, AlertTriangle, CheckCircle2, ArrowRight } from "lucide-react";
import { Card, CardHeader, CardContent } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { Select } from "../../../components/ui/Select";
import { Input } from "../../../components/ui/Input";
import { useToast } from "../../../components/ui/Toast";
import { RankingImportAPI } from "../../../lib/rankingImportApi";

const COURSE_OPTIONS = [
  { value: "LC", label: "Long Course (50m)" },
  { value: "SC", label: "Short Course (25m)" },
];

// Import tab — upload one or more Hy-Tek result PDFs. Course type is chosen HERE
// and is the source of truth (the parser only reads it from the file as a hint).
export default function RankingImportPanel({ onImported }) {
  const toast = useToast();
  const fileRef = useRef(null);

  const currentYear = new Date().getFullYear();
  const [courseType, setCourseType] = useState("LC");
  const [season, setSeason] = useState(String(currentYear));
  const [meetName, setMeetName] = useState("");
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  const seasonOptions = useMemo(
    () => Array.from({ length: 8 }, (_, i) => currentYear - i).map((y) => ({ value: String(y), label: String(y) })),
    [currentYear]
  );

  const addFiles = (list) => {
    const pdfs = Array.from(list || []).filter((f) => /\.pdf$/i.test(f.name));
    if (pdfs.length !== (list?.length ?? 0)) {
      toast.show("Only PDFs", "Some files were skipped — only Hy-Tek PDF result files are supported.", "warning");
    }
    // De-dupe by name+size so re-picking doesn't stack duplicates.
    setFiles((prev) => {
      const seen = new Set(prev.map((f) => `${f.name}:${f.size}`));
      return [...prev, ...pdfs.filter((f) => !seen.has(`${f.name}:${f.size}`))];
    });
  };

  const removeFile = (idx) => setFiles((prev) => prev.filter((_, i) => i !== idx));

  const upload = async () => {
    if (!files.length) {
      toast.show("No files", "Pick at least one Hy-Tek result PDF to import.", "warning");
      return;
    }
    setBusy(true);
    setResult(null);
    try {
      const res = await RankingImportAPI.importFiles(files, {
        courseType,
        season: season ? parseInt(season, 10) : null,
        meetInfo: meetName.trim() ? { name: meetName.trim() } : {},
      });
      setResult(res);
      setFiles([]);
      if (fileRef.current) fileRef.current.value = "";
      const parsed = res.stats?.resultsParsed ?? 0;
      const meetCount = res.batches?.length ?? 0;
      if (parsed > 0) {
        toast.show("Imported for review",
          `${meetCount} meet${meetCount === 1 ? "" : "s"} · ${parsed} results staged. Review and approve to publish.`,
          "success");
      } else {
        toast.show("Nothing staged", "No results were parsed — see the details below.", "warning");
      }
    } catch (e) {
      console.error(e);
      const msg = String(e?.message || e || "");
      const code = e?.code || "";
      if (/could not find the table|schema cache|relation .* does not exist/i.test(msg)) {
        toast.show("Setup needed", "The ranking_ tables are missing. Run the Phase 1 schema in Supabase, then retry.", "error");
      } else if (code === "42501" || /row-level security|violates row-level/i.test(msg)) {
        toast.show("Permission blocked (RLS)", "The database rejected the insert (403). The ranking tables need their permissive base policy — run phase1_fix_permissive_rls.sql.", "error");
      } else {
        toast.show("Import failed", msg || "Could not import the files.", "error");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr,1.1fr]">
      {/* ---------- upload form ---------- */}
      <Card>
        <CardHeader>
          <h2 className="text-xl font-semibold text-main flex items-center gap-2">
            <Upload className="w-5 h-5 text-primary-500" /> Upload results
          </h2>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Course type"
              required
              options={COURSE_OPTIONS}
              value={courseType}
              onChange={(e) => setCourseType(e.target.value)}
            />
            <Select
              label="Season (year)"
              options={seasonOptions}
              value={season}
              onChange={(e) => setSeason(e.target.value)}
            />
          </div>

          <Input
            label="Meet name (optional)"
            placeholder="Leave blank to read it from the file"
            value={meetName}
            onChange={(e) => setMeetName(e.target.value)}
          />

          {/* dropzone */}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              addFiles(e.dataTransfer.files);
            }}
            onClick={() => fileRef.current?.click()}
            className="cursor-pointer rounded-xl border-2 border-dashed border-border hover:border-primary-500/50 bg-base-alt/40 transition-colors p-8 text-center"
          >
            <Upload className="w-8 h-8 mx-auto text-primary-500/70 mb-2" />
            <p className="text-lg text-main font-medium">Drop PDF result files here, or click to browse</p>
            <p className="text-sm text-muted">Multiple files allowed. Long/Short course set above.</p>
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf"
              multiple
              className="hidden"
              onChange={(e) => addFiles(e.target.files)}
            />
          </div>

          {files.length > 0 && (
            <ul className="space-y-2">
              {files.map((f, i) => (
                <li key={`${f.name}:${f.size}`} className="flex items-center gap-3 rounded-lg border border-border bg-base-alt/40 px-3 py-2">
                  <FileText className="w-4 h-4 text-primary-500 flex-shrink-0" />
                  <span className="flex-1 truncate text-lg text-main">{f.name}</span>
                  <span className="text-sm text-muted">{(f.size / 1024).toFixed(0)} KB</span>
                  <button onClick={() => removeFile(i)} className="text-muted hover:text-red-400" title="Remove">
                    <X className="w-4 h-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <Button onClick={upload} loading={busy} icon={busy ? undefined : Upload} disabled={!files.length} className="w-full">
            {busy ? "Importing…" : `Import ${files.length || ""} file${files.length === 1 ? "" : "s"}`.trim()}
          </Button>
        </CardContent>
      </Card>

      {/* ---------- result summary ---------- */}
      <Card>
        <CardHeader>
          <h2 className="text-xl font-semibold text-main">Import summary</h2>
        </CardHeader>
        <CardContent>
          {!result ? (
            <p className="text-lg text-muted py-8 text-center">
              Upload a file to see how many results were parsed, matched, and need review.
            </p>
          ) : (
            <div className="space-y-5">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Stat label="Parsed" value={result.stats?.resultsParsed ?? 0} tone="info" />
                <Stat label="Auto-matched" value={result.stats?.matched ?? 0} tone="success" />
                <Stat label="Need review" value={result.stats?.needingReview ?? 0} tone="warning" />
                <Stat label="New swimmers" value={result.stats?.newSwimmers ?? 0} tone="muted" />
              </div>

              {/* Each PDF becomes its own meet/batch — list them so a bulk upload
                  is clearly N separate meets, not one blob. */}
              {result.batches?.length > 0 && (
                <div className="rounded-lg border border-border bg-base-alt/40 divide-y divide-border">
                  <p className="px-3 py-2 text-lg font-medium text-main">
                    {result.batches.length} meet{result.batches.length === 1 ? "" : "s"} imported
                  </p>
                  <ul className="max-h-56 overflow-y-auto">
                    {result.batches.map((b) => (
                      <li key={b.batchId} className="flex items-center gap-3 px-3 py-1.5 text-sm">
                        <FileText className="w-4 h-4 text-primary-500 flex-shrink-0" />
                        <span className="flex-1 truncate text-main" title={b.fileName}>{b.meetName}</span>
                        <span className={b.resultsParsed ? "text-muted" : "text-amber-500"}>
                          {b.resultsParsed} rows
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {result.duplicateFiles?.length > 0 && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
                  <p className="text-lg font-medium text-amber-500 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" /> {result.duplicateFiles.length} duplicate file(s) skipped
                  </p>
                  <ul className="mt-1 text-sm text-muted list-disc list-inside">
                    {result.duplicateFiles.map((d, i) => <li key={i}>{d.fileName} — {d.reason}</li>)}
                  </ul>
                </div>
              )}

              {result.warnings?.length > 0 && (
                <div className="rounded-lg border border-border bg-base-alt/40 p-3 max-h-40 overflow-y-auto">
                  <p className="text-lg font-medium text-main mb-1">Warnings</p>
                  <ul className="text-sm text-muted list-disc list-inside space-y-0.5">
                    {result.warnings.map((w, i) => <li key={i}>{w}</li>)}
                  </ul>
                </div>
              )}

              {(result.stats?.resultsParsed ?? 0) > 0 && (
                <div className="flex items-center gap-3 pt-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  <span className="text-lg text-main flex-1">Staged and ready for review.</span>
                  <Button variant="outline" size="sm" icon={ArrowRight} onClick={() => onImported?.(result.batchId)}>
                    {result.batches?.length > 1 ? "Review batches" : "Review this batch"}
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

const TONE = {
  info: "text-blue-500",
  success: "text-emerald-500",
  warning: "text-amber-500",
  muted: "text-muted",
};

function Stat({ label, value, tone }) {
  return (
    <div className="rounded-xl border border-border bg-base-alt/40 px-3 py-3 text-center">
      <div className={`text-2xl font-bold ${TONE[tone] || "text-main"}`}>{value}</div>
      <div className="text-sm text-muted">{label}</div>
    </div>
  );
}
