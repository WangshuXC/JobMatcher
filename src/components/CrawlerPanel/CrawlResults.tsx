"use client";

import { motion, AnimatePresence } from "motion/react";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle } from "lucide-react";
import { useCrawlerStore } from "@/stores/crawler-store";

export default function CrawlResults() {
  const results = useCrawlerStore((s) => s.results);
  const sources = useCrawlerStore((s) => s.sources);

  return (
    <AnimatePresence>
      {results.length > 0 && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="space-y-3"
        >
          <h3 className="text-sm font-medium text-muted-foreground">
            抓取结果
          </h3>
          {results.map((result, index) => (
            <motion.div
              key={result.source}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.15 }}
              className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
            >
              <div className="flex items-center gap-3">
                {result.status === "completed" ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                ) : (
                  <XCircle className="h-5 w-5 text-destructive" />
                )}
                <div>
                  <p className="font-medium">
                    {sources.find((s) => s.id === result.source)?.name ||
                      result.source}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {result.message}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{result.jobCount} 个职位</Badge>
                {result.duration && (
                  <Badge variant="outline">
                    {(result.duration / 1000).toFixed(1)}s
                  </Badge>
                )}
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
