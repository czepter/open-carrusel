import { DollarSign, AlertTriangle } from "lucide-react";
import { Badge } from "./badge";
import { cn } from "@/lib/utils";
import { BUDGET_WARNING_USD } from "@/types/carousel";

interface CostBadgeProps {
  costUsd: number;
  className?: string;
}

export function formatCost(usd: number): string {
  return `$${usd.toFixed(2)}`;
}

export function CostBadge({ costUsd, className }: CostBadgeProps) {
  if (costUsd <= 0) return null;

  const isWarning = costUsd >= BUDGET_WARNING_USD;

  return (
    <Badge
      variant="secondary"
      className={cn(
        "text-[10px] tabular-nums gap-1",
        isWarning && "bg-amber-500/15 text-amber-600 border-amber-500/30",
        className
      )}
    >
      {isWarning ? (
        <AlertTriangle className="h-2.5 w-2.5" />
      ) : (
        <DollarSign className="h-2.5 w-2.5" />
      )}
      {formatCost(costUsd)}
    </Badge>
  );
}
