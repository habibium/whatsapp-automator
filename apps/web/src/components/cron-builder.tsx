import cronstrue from "cronstrue";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

type Frequency = "daily" | "weekly" | "monthly" | "custom";

type BuilderState = {
  frequency: Frequency;
  time: string;
  weekdays: number[];
  monthDay: number;
  custom: string;
};

const WEEKDAYS = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 0, label: "Sun" }
];

const DEFAULT_STATE: BuilderState = {
  frequency: "daily",
  time: "09:00",
  weekdays: [1],
  monthDay: 1,
  custom: "0 9 * * *"
};

/** Best-effort parse of a 5-field cron expression back into builder controls. */
function parseCron(expr: string): BuilderState {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) {
    return { ...DEFAULT_STATE, frequency: "custom", custom: expr || DEFAULT_STATE.custom };
  }

  const [minuteRaw, hourRaw, dom, , dow] = parts as [string, string, string, string, string];
  const minute = Number(minuteRaw);
  const hour = Number(hourRaw);
  if (!Number.isInteger(minute) || !Number.isInteger(hour)) {
    return { ...DEFAULT_STATE, frequency: "custom", custom: expr };
  }
  const time = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;

  if (dom === "*" && dow === "*")
    return { ...DEFAULT_STATE, frequency: "daily", time, custom: expr };
  if (dom === "*" && dow !== "*") {
    const weekdays = dow.split(",").map(Number).filter(Number.isInteger);
    if (weekdays.length > 0) {
      return { ...DEFAULT_STATE, frequency: "weekly", time, weekdays, custom: expr };
    }
  }
  if (dom !== "*" && dow === "*") {
    const monthDay = Number(dom);
    if (Number.isInteger(monthDay)) {
      return { ...DEFAULT_STATE, frequency: "monthly", time, monthDay, custom: expr };
    }
  }
  return { ...DEFAULT_STATE, frequency: "custom", custom: expr };
}

/** Builds a 5-field cron expression from the current controls. */
function buildCron(state: BuilderState): string {
  if (state.frequency === "custom") return state.custom.trim();
  const [hourRaw, minuteRaw] = state.time.split(":");
  const hour = Number(hourRaw) || 0;
  const minute = Number(minuteRaw) || 0;
  if (state.frequency === "daily") return `${minute} ${hour} * * *`;
  if (state.frequency === "weekly") {
    const days =
      state.weekdays.length > 0 ? [...state.weekdays].sort((a, b) => a - b).join(",") : "*";
    return `${minute} ${hour} * * ${days}`;
  }
  return `${minute} ${hour} ${state.monthDay} * *`;
}

function describe(expr: string): string {
  try {
    return cronstrue.toString(expr, { verbose: false });
  } catch {
    return "Not a valid schedule";
  }
}

type CronBuilderProps = {
  value: string;
  onChange: (cron: string) => void;
};

/** Visual builder for recurring schedules — emits a standard 5-field cron string. */
export function CronBuilder({ value, onChange }: CronBuilderProps) {
  const [state, setState] = useState(() => parseCron(value));

  function update(patch: Partial<BuilderState>) {
    const next = { ...state, ...patch };
    setState(next);
    onChange(buildCron(next));
  }

  function toggleWeekday(day: number) {
    const weekdays = state.weekdays.includes(day)
      ? state.weekdays.filter((d) => d !== day)
      : [...state.weekdays, day];
    update({ weekdays });
  }

  return (
    <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Frequency</Label>
          <Select
            value={state.frequency}
            onValueChange={(frequency) => update({ frequency: frequency as Frequency })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">Daily</SelectItem>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="custom">Custom cron</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {state.frequency !== "custom" && (
          <div className="space-y-1.5">
            <Label className="text-xs">Time</Label>
            <Input
              type="time"
              value={state.time}
              onChange={(e) => update({ time: e.target.value })}
            />
          </div>
        )}

        {state.frequency === "monthly" && (
          <div className="space-y-1.5">
            <Label className="text-xs">Day of month</Label>
            <Select
              value={String(state.monthDay)}
              onValueChange={(day) => update({ monthDay: Number(day) })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 28 }, (_, i) => i + 1).map((day) => (
                  <SelectItem key={day} value={String(day)}>
                    {day}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {state.frequency === "weekly" && (
        <div className="space-y-1.5">
          <Label className="text-xs">Repeat on</Label>
          <div className="flex flex-wrap gap-1.5">
            {WEEKDAYS.map((day) => (
              <button
                key={day.value}
                type="button"
                onClick={() => toggleWeekday(day.value)}
                className={cn(
                  "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
                  state.weekdays.includes(day.value)
                    ? "border-primary bg-primary text-primary-foreground"
                    : "hover:bg-accent"
                )}
              >
                {day.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {state.frequency === "custom" && (
        <div className="space-y-1.5">
          <Label className="text-xs">Cron expression</Label>
          <Input
            value={state.custom}
            placeholder="0 9 * * 1-5"
            onChange={(e) => update({ custom: e.target.value })}
            className="font-mono"
          />
        </div>
      )}

      <p className="text-xs text-muted-foreground">{describe(buildCron(state))}</p>
    </div>
  );
}
