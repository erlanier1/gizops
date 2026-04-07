import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: "up" | "down" | "neutral";
  className?: string;
}

export function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  className,
}: StatCardProps) {
  return (
    <div className={cn("rounded-xl bg-smoke border border-line p-5", className)}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-medium text-mist uppercase tracking-wider">{title}</p>
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-hover">
          <Icon className="h-4 w-4 text-ember" />
        </div>
      </div>
      <p className="text-2xl font-bold text-cream">{value}</p>
      {subtitle && (
        <p
          className={cn(
            "mt-1 text-xs",
            trend === "up"   && "text-green-400",
            trend === "down" && "text-red-400",
            (!trend || trend === "neutral") && "text-mist"
          )}
        >
          {subtitle}
        </p>
      )}
    </div>
  );
}
