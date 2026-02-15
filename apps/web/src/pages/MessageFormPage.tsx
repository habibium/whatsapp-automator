import { ArrowLeft, Clock, Loader2, Save, User, Users } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription } from "../components/ui/alert";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Separator } from "../components/ui/separator";
import { Switch } from "../components/ui/switch";
import { Textarea } from "../components/ui/textarea";
import { useMessage, useMessages } from "../hooks/useMessages";
import { api, type WhatsAppGroup } from "../lib/api";

const CRON_PRESETS = [
  { label: "Every minute", value: "* * * * *" },
  { label: "Every 5 min", value: "*/5 * * * *" },
  { label: "Every hour", value: "0 * * * *" },
  { label: "Daily 9 AM", value: "0 9 * * *" },
  { label: "Daily 6 PM", value: "0 18 * * *" },
  { label: "Monday 9 AM", value: "0 9 * * 1" },
  { label: "Weekdays 9 AM", value: "0 9 * * 1-5" },
  { label: "Monthly 1st", value: "0 9 1 * *" }
];

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
    <div className="mx-auto max-w-2xl space-y-8">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/messages")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {isEditing ? "Edit Message" : "New Scheduled Message"}
          </h1>
          <p className="mt-1 text-muted-foreground">
            {isEditing
              ? "Update your scheduled message settings"
              : "Set up a new automated WhatsApp message"}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {/* Recipient */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recipient</CardTitle>
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
                  onClick={() => setIsGroup(false)}
                  className="flex-1"
                >
                  <User className="mr-2 h-4 w-4" />
                  Contact
                </Button>
                <Button
                  type="button"
                  variant={isGroup ? "default" : "outline"}
                  size="sm"
                  onClick={() => setIsGroup(true)}
                  className="flex-1"
                >
                  <Users className="mr-2 h-4 w-4" />
                  Group
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="target">{isGroup ? "Group Name" : "Phone Number"}</Label>
              <Input
                id="target"
                type={isGroup ? "text" : "tel"}
                placeholder={isGroup ? "Enter group name exactly as it appears" : "+1234567890"}
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">
                {isGroup
                  ? "Enter the exact group name (case-insensitive)"
                  : "Include country code without spaces or dashes"}
              </p>

              {isGroup && groups.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {loadingGroups ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {groups.slice(0, 8).map((g) => (
                    <Badge
                      key={g.id}
                      variant={target === g.name ? "default" : "secondary"}
                      className="cursor-pointer"
                      onClick={() => setTarget(g.name)}
                    >
                      {g.name}
                    </Badge>
                  ))}
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>

        {/* Message */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Message</CardTitle>
            <CardDescription>Write the content that will be sent</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Label htmlFor="message">Content</Label>
            <Textarea
              id="message"
              placeholder="Type your message here..."
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              required
              rows={5}
              className="resize-y"
            />
            <p className="text-xs text-muted-foreground">{messageText.length} characters</p>
          </CardContent>
        </Card>

        {/* Schedule */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Schedule</CardTitle>
            <CardDescription>Define when this message should be sent</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cron">Cron Expression</Label>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="cron"
                  type="text"
                  className="pl-9 font-mono"
                  placeholder="* * * * *"
                  value={cronExpression}
                  onChange={(e) => setCronExpression(e.target.value)}
                  required
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Format: minute hour day-of-month month day-of-week
              </p>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Quick presets</Label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {CRON_PRESETS.map((preset) => (
                  <Button
                    key={preset.value}
                    type="button"
                    variant={cronExpression === preset.value ? "default" : "outline"}
                    size="sm"
                    className={cn(
                      "h-auto whitespace-normal py-2 text-xs",
                      cronExpression === preset.value && "ring-2 ring-primary/20"
                    )}
                    onClick={() => setCronExpression(preset.value)}
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>
            </div>
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
        <div className="flex items-center justify-end gap-3">
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
