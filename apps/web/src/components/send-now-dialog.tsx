import { RECIPIENT_TYPES, type SendNowInput } from "@pkg/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { RecipientField } from "@/components/recipient-field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { useSendNow } from "@/hooks/use-messages";

const schema = z.object({
  recipientType: z.enum(RECIPIENT_TYPES),
  recipient: z.string().trim().min(1, "Recipient is required"),
  recipientName: z.string().optional(),
  body: z.string().trim().min(1, "Message cannot be empty").max(4096)
});

type Values = z.infer<typeof schema>;

type SendNowDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/** Compose and immediately send a one-off message — bypasses the scheduler. */
export function SendNowDialog({ open, onOpenChange }: SendNowDialogProps) {
  const sendNow = useSendNow();
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { recipientType: "contact", recipient: "", recipientName: "", body: "" }
  });

  async function onSubmit(values: Values) {
    const payload: SendNowInput = {
      recipientType: values.recipientType,
      recipient: values.recipient,
      recipientName: values.recipientName || undefined,
      body: values.body
    };
    try {
      await sendNow.mutateAsync(payload);
      toast.success("Message queued for delivery");
      form.reset();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Send failed");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Send a message now</DialogTitle>
          <DialogDescription>Delivered immediately. Visible in History.</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <RecipientField />
            <FormField
              control={form.control}
              name="body"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Message</FormLabel>
                  <FormControl>
                    <Textarea rows={5} placeholder="Hello…" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? "Sending…" : "Send now"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
