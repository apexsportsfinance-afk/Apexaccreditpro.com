import React, { useState } from "react";
import { Upload, ClipboardCheck, Trophy, Users, Building2, ScrollText, Settings2, Waves } from "lucide-react";
import { Tabs } from "../../../components/ui/Tabs";
import RankingImportPanel from "./RankingImportPanel";
import RankingReviewPanel from "./RankingReviewPanel";
import RankingClubsPanel from "./RankingClubsPanel";
import RankingRankingsPanel from "./RankingRankingsPanel";
import RankingSettingsPanel from "./RankingSettingsPanel";
import RankingSwimmersPanel from "./RankingSwimmersPanel";
import RankingLogsPanel from "./RankingLogsPanel";

// Swimmers Ranking — cross-event permanent results ranking built from Hy-Tek
// result PDFs. Route: /admin/ranking (admin-only via AdminLayout).
// All tabs live: Import → Review → Clubs → Rankings → Swimmers → Logs → Settings.
const TABS = [
  { id: "import", label: "Import", icon: Upload },
  { id: "review", label: "Review", icon: ClipboardCheck },
  { id: "clubs", label: "Clubs", icon: Building2 },
  { id: "rankings", label: "Rankings", icon: Trophy },
  { id: "swimmers", label: "Swimmers", icon: Users },
  { id: "logs", label: "Import Logs", icon: ScrollText },
  { id: "settings", label: "Settings", icon: Settings2 },
];

export default function SwimmersRanking() {
  const [activeTab, setActiveTab] = useState("import");
  // Batch handed from Import → Review after a successful upload.
  const [reviewBatchId, setReviewBatchId] = useState(null);

  const goReview = (batchId) => {
    setReviewBatchId(batchId || null);
    setActiveTab("review");
  };

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-primary-500/10 border border-primary-500/20 flex items-center justify-center">
          <Waves className="w-6 h-6 text-primary-500" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-main">Swimmers Ranking</h1>
          <p className="text-lg text-muted font-light">
            Permanent cross-event ranking built from Hy-Tek result PDFs
          </p>
        </div>
      </header>

      <Tabs tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab} className="overflow-x-auto" />

      <div>
        {activeTab === "import" && <RankingImportPanel onImported={goReview} />}
        {activeTab === "review" && <RankingReviewPanel initialBatchId={reviewBatchId} />}
        {activeTab === "clubs" && <RankingClubsPanel />}
        {activeTab === "rankings" && <RankingRankingsPanel />}
        {activeTab === "swimmers" && <RankingSwimmersPanel />}
        {activeTab === "logs" && <RankingLogsPanel />}
        {activeTab === "settings" && <RankingSettingsPanel />}
      </div>
    </div>
  );
}
