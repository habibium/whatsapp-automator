import { render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import type { ReactNode } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/use-whatsapp", () => ({
  useWhatsAppGroups: vi.fn()
}));

import { useWhatsAppGroups } from "@/hooks/use-whatsapp";
import { RecipientField } from "./recipient-field";

type FormValues = {
  recipientType: "contact" | "group";
  recipient: string;
  recipientName?: string;
};

function Harness({
  children
}: {
  children: (form: ReturnType<typeof useForm<FormValues>>) => ReactNode;
}) {
  const form = useForm<FormValues>({
    defaultValues: { recipientType: "contact", recipient: "", recipientName: "" }
  });
  return <FormProvider {...form}>{children(form)}</FormProvider>;
}

afterEach(() => {
  vi.mocked(useWhatsAppGroups).mockReset();
});

describe("RecipientField", () => {
  it("captures a phone number for contacts", async () => {
    vi.mocked(useWhatsAppGroups).mockReturnValue({
      data: [],
      isLoading: false
    } as unknown as ReturnType<typeof useWhatsAppGroups>);

    let formValues: FormValues = { recipientType: "contact", recipient: "", recipientName: "" };
    render(
      <Harness>
        {(form) => {
          formValues = form.watch();
          return <RecipientField />;
        }}
      </Harness>
    );

    const user = userEvent.setup();
    const input = screen.getByPlaceholderText(/\+1 555/);
    await user.type(input, "+15555550100");
    await waitFor(() => {
      expect(formValues.recipient).toBe("+15555550100");
      expect(formValues.recipientName).toBe("+15555550100");
    });
  });

  it("shows a hint when WhatsApp has no groups", async () => {
    vi.mocked(useWhatsAppGroups).mockReturnValue({
      data: [],
      isLoading: false
    } as unknown as ReturnType<typeof useWhatsAppGroups>);

    render(<Harness>{() => <RecipientField />}</Harness>);

    const user = userEvent.setup();
    await user.click(screen.getByRole("tab", { name: "Group" }));
    expect(await screen.findByText(/link WhatsApp first/i)).toBeInTheDocument();
  });
});
