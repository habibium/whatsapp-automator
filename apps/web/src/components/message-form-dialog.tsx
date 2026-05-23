import {
  type RecipientType,
  RECIPIENT_TYPES,
  type ScheduledMessageInput,
  SCHEDULE_KINDS,
  type ScheduleKind,
  cronExpressionSchema
} from "@pkg/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { CronBuilder } from "@/components/cron-builder";
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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useCreateMessage, useUpdateMessage } from "@/hooks/use-messages";
import { useTemplates } from "@/hooks/use-templates";

/** Form schema — accepts a local `datetime-local` string for runAt and converts on submit. */
const formSchema = z
  .object({
    recipientType: z.enum(RECIPIENT_TYPES),
    recipient: z.string().trim().min(1, "Recipient is required"),
    recipientName: z.string().optional(),
    body: z.string().trim().min(1, "Message cannot be empty").max(4096),
    scheduleKind: z.enum(SCHEDULE_KINDS),
    runAt: z.string().optional(),
    cron: z.string().optional(),
    timezone: z.string(),
    templateId: z.string().nullish(),
    enabled: z.boolean()
  })
  .refine(
    (data) =>
      data.scheduleKind !== "once" ||
      (Boolean(data.runAt) && new Date(data.runAt!).getTime() > Date.now()),
    { path: ["runAt"], message: "Pick a future date and time" }
  )
  .refine(
    (data) => {
      if (data.scheduleKind !== "recurring") return true;
      if (!data.cron) return false;
      return cronExpressionSchema.safeParse(data.cron).success;
    },
    { path: ["cron"], message: "Pick a valid schedule" }
  );

type FormValues = z.infer<typeof formSchema>;

export type EditableMessage = {
  id: string;
  recipientType: RecipientType;
  recipient: string;
  recipientName: string | null;
  body: string;
  scheduleKind: ScheduleKind;
  runAt: string | null;
  cron: string | null;
  timezone: string;
  templateId: string | null;
  enabled: boolean;
};

type MessageFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  message: EditableMessage | null;
};

const BROWSER_TIMEZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

/** Converts an ISO timestamp to the value expected by `<input type="datetime-local">`. */
function isoToLocalInputValue(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

/** Default form state when creating a new schedule. */
function defaultValues(): FormValues {
  return {
    recipientType: "contact",
    recipient: "",
    recipientName: "",
    body: "",
    scheduleKind: "once",
    runAt: "",
    cron: "0 9 * * *",
    timezone: BROWSER_TIMEZONE,
    templateId: null,
    enabled: true
  };
}

/** Pulls defaults from an existing scheduled message for the edit case. */
function fromMessage(message: EditableMessage): FormValues {
  return {
    recipientType: message.recipientType,
    recipient: message.recipient,
    recipientName: message.recipientName ?? "",
    body: message.body,
    scheduleKind: message.scheduleKind,
    runAt: isoToLocalInputValue(message.runAt),
    cron: message.cron ?? "0 9 * * *",
    timezone: message.timezone || BROWSER_TIMEZONE,
    templateId: message.templateId,
    enabled: message.enabled
  };
}

/** Maps form values to the API input — handles the local-datetime conversion. */
function toApiInput(values: FormValues): ScheduledMessageInput {
  const base = {
    recipientType: values.recipientType,
    recipient: values.recipient,
    recipientName: values.recipientName || undefined,
    body: values.body,
    scheduleKind: values.scheduleKind,
    timezone: values.timezone,
    templateId: values.templateId ?? null,
    enabled: values.enabled
  };
  if (values.scheduleKind === "once") {
    return { ...base, runAt: new Date(values.runAt!).toISOString() };
  }
  return { ...base, cron: values.cron };
}

/** Create or edit a scheduled message. */
export function MessageFormDialog({ open, onOpenChange, message }: MessageFormDialogProps) {
  const templates = useTemplates();
  const create = useCreateMessage();
  const update = useUpdateMessage();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    values: message ? fromMessage(message) : defaultValues()
  });

  const scheduleKind = form.watch("scheduleKind");
  const isEditing = Boolean(message);

  function applyTemplate(templateId: string) {
    if (templateId === "__none__") {
      form.setValue("templateId", null);
      return;
    }
    const template = templates.data?.find((t) => t.id === templateId);
    if (!template) return;
    form.setValue("templateId", template.id);
    form.setValue("body", template.body, { shouldValidate: true });
  }

  async function onSubmit(values: FormValues) {
    const payload = toApiInput(values);
    try {
      if (message) {
        await update.mutateAsync({ id: message.id, input: payload });
        toast.success("Schedule updated");
      } else {
        await create.mutateAsync(payload);
        toast.success("Schedule created");
      }
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit schedule" : "New scheduled message"}</DialogTitle>
          <DialogDescription>
            Set who to message, what to send, and when it should go out.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <RecipientField />

            {templates.data && templates.data.length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Apply template (optional)</Label>
                <Select
                  value={form.watch("templateId") ?? "__none__"}
                  onValueChange={applyTemplate}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    {templates.data.map((template) => (
                      <SelectItem key={template.id} value={template.id}>
                        {template.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

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

            <FormField
              control={form.control}
              name="scheduleKind"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Schedule</FormLabel>
                  <Tabs value={field.value} onValueChange={(value) => field.onChange(value)}>
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="once">One-time</TabsTrigger>
                      <TabsTrigger value="recurring">Recurring</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </FormItem>
              )}
            />

            {scheduleKind === "once" ? (
              <FormField
                control={form.control}
                name="runAt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Send at</FormLabel>
                    <FormControl>
                      <Input type="datetime-local" {...field} />
                    </FormControl>
                    <FormDescription>
                      Times are in your local timezone ({BROWSER_TIMEZONE}).
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : (
              <FormField
                control={form.control}
                name="cron"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Repeat</FormLabel>
                    <CronBuilder value={field.value ?? ""} onChange={field.onChange} />
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="enabled"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <FormLabel>Enabled</FormLabel>
                    <FormDescription>Turn off to pause without deleting.</FormDescription>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? "Saving…" : isEditing ? "Save changes" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
