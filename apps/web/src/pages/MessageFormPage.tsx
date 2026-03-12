import { zodResolver } from "@hookform/resolvers/zod";
import {
  AlertCircle,
  ArrowLeft,
  Loader2,
  MessageSquareText,
  Save,
  Send,
  Unplug,
  User,
  Users
} from "lucide-react";
import { useCallback, useEffect, useRef } from "react";
import { Controller, useForm } from "react-hook-form";
import { useNavigate, useParams } from "react-router-dom";
import { z } from "zod";
import { CronScheduleBuilder } from "../components/CronScheduleBuilder";
import { GroupCombobox } from "../components/GroupCombobox";
import { TemplateVariableChips } from "../components/TemplateVariableChips";
import { Alert, AlertDescription, AlertTitle } from "../components/ui/alert";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldLabel
} from "../components/ui/field";
import { Input } from "../components/ui/input";
import { Skeleton } from "../components/ui/skeleton";
import { Switch } from "../components/ui/switch";
import { Textarea } from "../components/ui/textarea";
import {
  useCreateMessage,
  useMessage,
  useServerTimezone,
  useUpdateMessage,
  useWhatsAppGroups
} from "../lib/queries";
import { useWhatsAppStore } from "../stores/whatsapp";

// ── Zod Schema ─────────────────────────────────────────────────────

const scheduleValueSchema = z.object({
  scheduleType: z.enum(["once", "recurring"]),
  cronExpression: z.string().nullable(),
  scheduledAt: z.string().nullable()
});

const messageFormSchema = z.object({
  target: z.string().min(1, { error: "Recipient is required" }),
  isGroup: z.boolean(),
  message: z.string().min(1, { error: "Message content is required" }),
  schedule: scheduleValueSchema,
  enabled: z.boolean()
});

type MessageFormValues = z.infer<typeof messageFormSchema>;

const defaultValues: MessageFormValues = {
  target: "",
  isGroup: false,
  message: "",
  schedule: {
    scheduleType: "recurring",
    cronExpression: "0 9 * * *",
    scheduledAt: null
  },
  enabled: true
};

// ── Skeleton ───────────────────────────────────────────────────────

function FormSkeleton() {
  return (
    <div className="mx-auto max-w-2xl space-y-5 pb-8">
      <div className="mb-8 flex items-center gap-4">
        <Skeleton className="h-9 w-9 rounded" />
        <div className="space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
      </div>
      {Array.from({ length: 3 }).map((_, i) => (
        // oxlint-disable-next-line react/no-array-index-key
        <Card key={i}>
          <CardHeader className="pb-4">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-4 w-48" />
          </CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ── Page Component ─────────────────────────────────────────────────

export function MessageFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditing = Boolean(id);

  // WhatsApp connection check
  const whatsappStatus = useWhatsAppStore((s) => s.status);
  const whatsappLoading = useWhatsAppStore((s) => s.loading);
  const isConnected = whatsappStatus === "connected";

  // Queries
  const { data: existingMessage, isLoading: loadingMessage, error: messageError } = useMessage(id);
  const createMutation = useCreateMessage();
  const updateMutation = useUpdateMessage();

  // React Hook Form
  const form = useForm<MessageFormValues>({
    resolver: zodResolver(messageFormSchema),
    defaultValues
  });

  const isGroup = form.watch("isGroup");
  const messageText = form.watch("message");

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Groups query — only fetch when isGroup is true
  const { data: groups = [], isLoading: loadingGroups } = useWhatsAppGroups(isGroup);

  // Server timezone
  const { data: serverTimezone } = useServerTimezone();

  // Populate form when existing message loads
  useEffect(() => {
    if (existingMessage) {
      form.reset({
        target: existingMessage.target,
        isGroup: existingMessage.isGroup,
        message: existingMessage.message,
        schedule: {
          scheduleType: existingMessage.scheduleType,
          cronExpression: existingMessage.cronExpression,
          scheduledAt: existingMessage.scheduledAt
        },
        enabled: existingMessage.enabled
      });
    }
  }, [existingMessage, form]);

  const handleInsertVariable = useCallback(
    (variable: string) => {
      const textarea = textareaRef.current;
      if (!textarea) {
        const current = form.getValues("message");
        form.setValue("message", current + variable, { shouldValidate: true });
        return;
      }

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const value = textarea.value;
      const newValue = value.substring(0, start) + variable + value.substring(end);

      form.setValue("message", newValue, { shouldValidate: true });

      requestAnimationFrame(() => {
        const newPos = start + variable.length;
        textarea.focus();
        textarea.setSelectionRange(newPos, newPos);
      });
    },
    [form]
  );

  const saving = createMutation.isPending || updateMutation.isPending;

  const onSubmit = (data: MessageFormValues) => {
    const onSuccess = () => navigate("/");

    const payload = {
      target: data.target,
      isGroup: data.isGroup,
      message: data.message,
      scheduleType: data.schedule.scheduleType,
      cronExpression: data.schedule.cronExpression,
      scheduledAt: data.schedule.scheduledAt,
      enabled: data.enabled
    };

    if (isEditing && id) {
      updateMutation.mutate({ id, data: payload }, { onSuccess });
    } else {
      createMutation.mutate(payload, { onSuccess });
    }
  };

  if (loadingMessage && isEditing) {
    return <FormSkeleton />;
  }

  // Gate: WhatsApp must be connected
  if (!isConnected && !whatsappLoading) {
    return (
      <div className="mx-auto max-w-2xl pb-8">
        <div className="mb-8 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")} className="shrink-0">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold tracking-tight">
            {isEditing ? "Edit Message" : "New Scheduled Message"}
          </h1>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-500/10">
              <Unplug className="h-7 w-7 text-amber-500" />
            </div>
            <h3 className="mt-4 text-lg font-semibold">WhatsApp Not Connected</h3>
            <p className="mt-1 text-center text-sm text-muted-foreground">
              You need to connect your WhatsApp account before you can{" "}
              {isEditing ? "edit" : "create"} messages.
            </p>
            <p className="mt-2 text-center text-xs text-muted-foreground">
              Click the connection indicator in the header to connect.
            </p>
            <Button variant="outline" className="mt-4" onClick={() => navigate("/")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Messages
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (messageError && isEditing) {
    return (
      <div className="mx-auto max-w-2xl pb-8">
        <div className="mb-8 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")} className="shrink-0">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold tracking-tight">Edit Message</h1>
        </div>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Failed to load message</AlertTitle>
          <AlertDescription>The message could not be found or an error occurred.</AlertDescription>
        </Alert>
      </div>
    );
  }

  const mutationError = createMutation.error || updateMutation.error;

  return (
    <div className="mx-auto max-w-2xl pb-8">
      {/* Header */}
      <div className="mb-8 flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/")} className="shrink-0">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {isEditing ? "Edit Message" : "New Scheduled Message"}
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {isEditing
              ? "Update your scheduled message settings"
              : "Set up a new automated WhatsApp message"}
          </p>
        </div>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
        {mutationError ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {mutationError instanceof Error ? mutationError.message : "Something went wrong"}
            </AlertDescription>
          </Alert>
        ) : null}

        {/* Recipient */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-base">
              <Send className="size-4 text-muted-foreground" />
              Recipient
            </CardTitle>
            <CardDescription>Choose who will receive this message</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Controller
              name="isGroup"
              control={form.control}
              render={({ field }) => (
                <Field>
                  <FieldLabel>Type</FieldLabel>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant={!field.value ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        field.onChange(false);
                        form.setValue("target", "");
                      }}
                      className="flex-1"
                    >
                      <User className="size-4" />
                      Contact
                    </Button>
                    <Button
                      type="button"
                      variant={field.value ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        field.onChange(true);
                        form.setValue("target", "");
                      }}
                      className="flex-1"
                    >
                      <Users className="size-4" />
                      Group
                    </Button>
                  </div>
                </Field>
              )}
            />

            <Controller
              name="target"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={field.name}>
                    {isGroup ? "Group Name" : "Phone Number"}
                  </FieldLabel>
                  {isGroup ? (
                    <GroupCombobox
                      value={field.value}
                      onChange={field.onChange}
                      groups={groups}
                      loading={loadingGroups}
                    />
                  ) : (
                    <Input
                      {...field}
                      id={field.name}
                      type="tel"
                      placeholder="+1234567890"
                      aria-invalid={fieldState.invalid}
                    />
                  )}
                  <FieldDescription>
                    {isGroup
                      ? "Search from your groups or type a custom group name"
                      : "Include country code without spaces or dashes"}
                  </FieldDescription>
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />
          </CardContent>
        </Card>

        {/* Message */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-base">
              <MessageSquareText className="h-4 w-4 text-muted-foreground" />
              Message
            </CardTitle>
            <CardDescription>Write the content that will be sent</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Controller
              name="message"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={field.name}>Content</FieldLabel>
                  <Textarea
                    ref={(el) => {
                      field.ref(el);
                      (textareaRef as React.MutableRefObject<HTMLTextAreaElement | null>).current =
                        el;
                    }}
                    id={field.name}
                    name={field.name}
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    placeholder="Type your message here..."
                    rows={5}
                    aria-invalid={fieldState.invalid}
                    className="resize-y font-mono text-sm"
                  />
                  <FieldDescription>{messageText.length} characters</FieldDescription>
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />
            <TemplateVariableChips onInsert={handleInsertVariable} />
          </CardContent>
        </Card>

        {/* Schedule */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-base">
              <svg
                className="h-4 w-4 text-muted-foreground"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                role="img"
                aria-label="Schedule"
              >
                <title>Schedule</title>
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              Schedule
            </CardTitle>
            <CardDescription>Define when this message should be sent</CardDescription>
          </CardHeader>
          <CardContent>
            <Controller
              name="schedule"
              control={form.control}
              render={({ field }) => (
                <CronScheduleBuilder
                  value={field.value}
                  onChange={field.onChange}
                  serverTimezone={serverTimezone}
                />
              )}
            />
          </CardContent>
        </Card>

        {/* Enabled toggle */}
        <Card>
          <CardContent className="py-4">
            <Controller
              name="enabled"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field orientation="horizontal" data-invalid={fieldState.invalid}>
                  <FieldContent>
                    <FieldLabel htmlFor={field.name}>Enabled</FieldLabel>
                    <FieldDescription>
                      Schedule will run automatically when enabled
                    </FieldDescription>
                  </FieldContent>
                  <Switch
                    id={field.name}
                    name={field.name}
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    aria-invalid={fieldState.invalid}
                  />
                </Field>
              )}
            />
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-1">
          <Button type="button" variant="outline" onClick={() => navigate("/")}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            {isEditing ? "Save Changes" : "Create Schedule"}
          </Button>
        </div>
      </form>
    </div>
  );
}
