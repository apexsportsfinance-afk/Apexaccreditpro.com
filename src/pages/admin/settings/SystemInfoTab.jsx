import React from "react";
import { motion } from "framer-motion";
import { Info, Database } from "lucide-react";
import Card, { CardHeader, CardContent } from "../../../components/ui/Card";
import Button from "../../../components/ui/Button";
import { useBranding } from "../../../contexts/BrandingContext";

export default function SystemInfoTab({ migrating, migrationStatus, onMigrate }) {
  const branding = useBranding();
  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
              <Info className="w-5 h-5 text-cyan-400" />
            </div>
            <h2 className="text-xl font-semibold text-white">System Information</h2>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* System Info Items */}
          {[
            { label: "Platform", value: `${branding.isApex ? "ApexAccreditation" : branding.name} v1.0` },
            { label: "Database", value: "Supabase (PostgreSQL)" },
            { label: "Authentication", value: "Supabase Auth" },
            { label: "Storage", value: "Supabase Storage" },
            { label: "Email Service", value: "SMTP (SSL/TLS)" },
            { label: "Environment", value: "Production Ready" }
          ].map((item) => (
            <div key={item.label} className="flex items-center justify-between py-2 border-b border-border last:border-0">
              <span className="text-lg text-muted font-extralight">{item.label}</span>
              <span className="text-lg text-main font-medium">{item.value}</span>
            </div>
          ))}

          <div className="pt-4 mt-2 border-t border-border flex flex-col gap-2">
            <Button
              onClick={onMigrate}
              loading={migrating}
              variant="secondary"
              icon={Database}
              className="w-full text-amber-400 border-amber-500/30 hover:bg-amber-500/10"
            >
              {migrating ? "Migrating DB Images..." : "Migrate Database Images to Supabase Storage"}
            </Button>
            {migrationStatus && (
              <p className="text-center text-sm text-slate-400 mt-1">{migrationStatus}</p>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
