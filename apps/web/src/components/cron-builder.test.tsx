import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CronBuilder } from "./cron-builder";

function setup(initial = "0 9 * * *") {
  const onChange = vi.fn();
  const utils = render(<CronBuilder value={initial} onChange={onChange} />);
  return { onChange, ...utils };
}

describe("CronBuilder", () => {
  it("parses a daily cron and shows the time", () => {
    setup("0 9 * * *");
    expect(screen.getByDisplayValue("09:00")).toBeInTheDocument();
  });

  it("describes the schedule with cronstrue", () => {
    setup("0 9 * * *");
    expect(screen.getByText(/9:00 AM/i)).toBeInTheDocument();
  });

  it("emits a new cron when the time changes", () => {
    const { onChange } = setup("0 9 * * *");
    fireEvent.change(screen.getByDisplayValue("09:00"), { target: { value: "14:30" } });
    expect(onChange).toHaveBeenLastCalledWith("30 14 * * *");
  });

  it("falls back to custom mode for unparseable input", () => {
    setup("not a cron");
    expect(screen.getByDisplayValue("not a cron")).toBeInTheDocument();
  });

  it("emits the raw value from the custom input", () => {
    const { onChange } = setup("not a cron");
    fireEvent.change(screen.getByDisplayValue("not a cron"), {
      target: { value: "*/5 * * * *" }
    });
    expect(onChange).toHaveBeenLastCalledWith("*/5 * * * *");
  });
});
