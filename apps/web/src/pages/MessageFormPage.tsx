import { ArrowLeft, Loader2, MessageSquareText, Save, Send, User, Users } from "lucide-react";
import { type FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { CronScheduleBuilder } from "../components/CronScheduleBuilder";
import { GroupCombobox } from "../components/GroupCombobox";
import { TemplateVariableChips } from "../components/TemplateVariableChips";
import { Alert, AlertDescription } from "../components/ui/alert";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Switch } from "../components/ui/switch";
import { Textarea } from "../components/ui/textarea";
import { useMessage, useMessages } from "../hooks/useMessages";
import { api, type WhatsAppGroup } from "../lib/api";

export function MessageFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { message, loading: loadingMessage } = useMessage(id);
  const { create, update } = useMessages();

  const [target, setTarget] = useState("");
  const [isGroup, setIsGroup] = useState(false);
  const [messageText, setMessageText] = useState("");
  const [cronExpression, setCronExpression] = useState("0 9 * * *");
  const [enabled, setEnabled] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [groups, setGroups] = useState<WhatsAppGroup[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isEditing = Boolean(id);

  useEffect(() => {
    if (message) {
      setTarget(message.target);
      setIsGroup(message.isGroup);
      setMessageText(message.message);
      setCronExpression(message.cronExpression);
      setEnabled(message.enabled);
    }
  }, [message]);

  useEffect(() => {
    if (isGroup && groups.length === 0) {
      setLoadingGroups(true);
      api.whatsapp.groups().then((result) => {
        if (result.success) {
          setGroups(result.data);
        }
        setLoadingGroups(false);
      });
    }
  }, [isGroup, groups.length]);

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

    // Restore cursor position after the inserted variable
    requestAnimationFrame(() => {
      const newPos = start + variable.length;
      textarea.focus();
      textarea.setSelectionRange(newPos, newPos);
    });
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);

    const data = {
      target,
      isGroup,
      message: messageText,
      cronExpression,
      enabled
    };

    let err: string | null;
    if (isEditing && id) {
      err = await update(id, data);
    } else {
      err = await create(data);
    }

    if (err) {
      setError(err);
      setSaving(false);
    } else {
      navigate("/messages");
    }
  };

  if (loadingMessage && isEditing) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl pb-8">
      {/* Header */}
      <div className="mb-8 flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/messages")}
          className="shrink-0"
        >
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
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
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
          <Button type="button" variant="outline" onClick={() => navigate("/messages")}>
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
