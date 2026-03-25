"use client";

import { motion } from "motion/react";
import { Building2 } from "lucide-react";
import { useCrawlerStore } from "@/stores/crawler-store";

export default function SourceSelector() {
  const sources = useCrawlerStore((s) => s.sources);
  const selectedSources = useCrawlerStore((s) => s.selectedSources);
  const isRunning = useCrawlerStore((s) => s.isRunning);
  const toggleSource = useCrawlerStore((s) => s.toggleSource);

  return (
    <div>
      <h3 className="text-sm font-medium mb-3 text-muted-foreground">
        选择招聘数据源
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {sources.map((source, index) => (
          <motion.div
            key={source.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="h-full"
          >
            <button
              type="button"
              onClick={() => toggleSource(source.id)}
              className={`w-full h-full p-4 rounded-xl border-2 transition-all text-left cursor-pointer ${
                selectedSources.includes(source.id)
                  ? "border-primary bg-primary/5 shadow-sm"
                  : "border-border hover:border-primary/50"
              }`}
              disabled={isRunning}
            >
              <div className="flex items-center gap-3">
                <Building2 className="h-5 w-5 text-muted-foreground shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{source.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {source.description}
                  </p>
                </div>
              </div>
            </button>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
