import { Braces } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

export const TEMPLATE_VARIABLES = [
  { key: "{{local_IP}}", description: "Server's local network IP address" },
  { key: "{{port}}", description: "Server port number" },
  { key: "{{server_date}}", description: "Current date on the server (e.g. Feb 15, 2026)" },
  { key: "{{server_time}}", description: "Current time on the server (e.g. 3:45 PM)" },
  { key: "{{username}}", description: "Your email address" },
  { key: "{{phone}}", description: "Your WhatsApp phone number" }
] as const;

type TemplateVariableChipsProps = {
  onInsert: (variable: string) => void;
};

export function TemplateVariableChips({ onInsert }: TemplateVariableChipsProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Braces className="h-3.5 w-3.5" />
        <span>Template variables</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {TEMPLATE_VARIABLES.map((v) => (
          <Tooltip key={v.key}>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => onInsert(v.key)}
                className={cn(
                  "inline-flex items-center rounded-md border border-border/60 bg-muted/40",
                  "px-2 py-0.5 font-mono text-xs text-muted-foreground",
                  "transition-colors hover:bg-primary/10 hover:text-primary hover:border-primary/30",
                  "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                )}
              >
                {v.key}
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-50">
              <p className="text-xs">{v.description}</p>
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </div>
  );
}
