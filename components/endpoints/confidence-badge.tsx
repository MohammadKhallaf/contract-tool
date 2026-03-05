import { Badge } from "@/components/ui/badge";
import type { ConfidenceLevel } from "@/types";
import { cn } from "@/lib/utils";

interface Props {
  level: ConfidenceLevel;
  score?: number;
}

export function ConfidenceBadge({ level, score }: Props) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "text-[10px] font-medium",
        level === "high" && "border-green-500 text-green-600 dark:text-green-400",
        level === "medium" && "border-yellow-500 text-yellow-600 dark:text-yellow-400",
        level === "low" && "border-red-500 text-red-600 dark:text-red-400"
      )}
      title={score !== undefined ? `Match score: ${Math.round(score * 100)}%` : undefined}
    >
      {level}
    </Badge>
  );
}
