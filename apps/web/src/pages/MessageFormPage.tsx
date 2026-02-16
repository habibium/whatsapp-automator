import {
  AlertCircle,
  ArrowLeft,
  Loader2,
  MessageSquareText,
  Save,
  Send,
  User,
  Users
} from "lucide-react";
import { type SubmitEvent, useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { CronScheduleBuilder } from "../components/CronScheduleBuilder";
import { GroupCombobox } from "../components/GroupCombobox";
import { TemplateVariableChips } from "../components/TemplateVariableChips";
import { Alert, AlertDescription, AlertTitle } from "../components/ui/alert";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Skeleton } from "../components/ui/skeleton";
import { Switch } from "../components/ui/switch";
import { Textarea } from "../components/ui/textarea";
import { useCreateMessage, useMessage, useUpdateMessage, useWhatsAppGroups } from "../lib/queries";

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
        // biome-ignore lint/suspicious/noArrayIndexKey: skeleton cards have no stable id
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

export function MessageFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditing = Boolean(id);

  // Queries
  const { data: existingMessage, isLoading: loadingMessage, error: messageError } = useMessage(id);
  const createMutation = useCreateMessage();
  const updateMutation = useUpdateMessage();

  // Form state
  const [target, setTarget] = useState("");
  const [isGroup, setIsGroup] = useState(false);
  const [messageText, setMessageText] = useState("");
  const [cronExpression, setCronExpression] = useState("0 9 * * *");
  const [enabled, setEnabled] = useState(true);
  const [formReady, setFormReady] = useState(!isEditing);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Groups query — only fetch when isGroup is true
  const { data: groups = [], isLoading: loadingGroups } = useWhatsAppGroups(isGroup);

  // Populate form when existing message loads
  useEffect(() => {
    if (existingMessage && !formReady) {
      setTarget(existingMessage.target);
      setIsGroup(existingMessage.isGroup);
      setMessageText(existingMessage.message);
      setCronExpression(existingMessage.cronExpression);
      setEnabled(existingMessage.enabled);
      setFormReady(true);
    }
  }, [existingMessage, formReady]);

  const handleInsertVariable = useCallback((variable: string) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      setMessageText((prev) => prev + variable);
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const before = textarea.value.substring(0, start);
    const after = textarea.value.substring(end);

    setMessageText(before + variable + after);

    requestAnimationFrame(() => {
      const newPos = start + variable.length;
      textarea.focus();
      textarea.setSelectionRange(newPos, newPos);
    });
  }, []);

  const saving = createMutation.isPending || updateMutation.isPending;

  const handleSubmit = (e: SubmitEvent) => {
    e.preventDefault();

    const data = {
      target,
      isGroup,
      message: messageText,
      cronExpression,
      enabled
    };

    const onSuccess = () => navigate("/");

    if (isEditing && id) {
      updateMutation.mutate({ id, data }, { onSuccess });
    } else {
      createMutation.mutate(data, { onSuccess });
    }
  };

  if (loadingMessage && isEditing) {
    return <FormSkeleton />;
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

      <form onSubmit={handleSubmit} className="space-y-5">
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
              <Send className="h-4 w-4 text-muted-foreground" />
              Recipient
            </CardTitle>
            <CardDescription>Choose who will receive this message</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Type</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={!isGroup ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setIsGroup(false);
                    setTarget("");
                  }}
                  className="flex-1"
                >
                  <User className="mr-2 h-4 w-4" />
                  Contact
                </Button>
                <Button
                  type="button"
                  variant={isGroup ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setIsGroup(true);
                    setTarget("");
                  }}
                  className="flex-1"
                >
                  <Users className="mr-2 h-4 w-4" />
                  Group
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="target">{isGroup ? "Group Name" : "Phone Number"}</Label>
              {isGroup ? (
                <GroupCombobox
                  value={target}
                  onChange={setTarget}
                  groups={groups}
                  loading={loadingGroups}
                />
              ) : (
                <Input
                  id="target"
                  type="tel"
                  placeholder="+1234567890"
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  required
                />
              )}
              <p className="text-xs text-muted-foreground">
                {isGroup
                  ? "Search from your groups or type a custom group name"
                  : "Include country code without spaces or dashes"}
              </p>
            </div>
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
            <div className="space-y-2">
              <Label htmlFor="message">Content</Label>
              <Textarea
                ref={textareaRef}
                id="message"
                placeholder="Type your message here..."
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                required
                rows={5}
                className="resize-y font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">{messageText.length} characters</p>
            </div>
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
            <CronScheduleBuilder value={cronExpression} onChange={setCronExpression} />
          </CardContent>
        </Card>

        {/* Enabled toggle */}
        <Card>
          <CardContent className="flex items-center justify-between py-4">
            <div>
              <p className="text-sm font-medium">Enabled</p>
              <p className="text-xs text-muted-foreground">
                Schedule will run automatically when enabled
              </p>
            </div>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-1">
          <Button type="button" variant="outline" onClick={() => navigate("/")}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            {isEditing ? "Save Changes" : "Create Schedule"}
          </Button>
        </div>
      </form>
    </div>
  );
}
