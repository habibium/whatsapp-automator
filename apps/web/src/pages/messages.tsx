import cronstrue from "cronstrue";
import { formatDistanceToNow } from "date-fns";
import { MoreHorizontalIcon, PlusIcon, SendIcon, UsersIcon, UserIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { type EditableMessage, MessageFormDialog } from "@/components/message-form-dialog";
import { SendNowDialog } from "@/components/send-now-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { useDeleteMessage, useMessages, useToggleMessage } from "@/hooks/use-messages";

type ScheduledMessageRow = ReturnType<typeof useMessages>["data"] extends (infer T)[] | undefined
  ? T
  : never;

function describeSchedule(message: ScheduledMessageRow): string {
  if (message.scheduleKind === "once") {
    if (!message.runAt) return "One-time";
    const date = new Date(message.runAt);
    if (Date.now() > date.getTime()) return "Past due";
    return `Once · ${formatDistanceToNow(date, { addSuffix: true })}`;
  }
  if (!message.cron) return "Recurring";
  try {
    return cronstrue.toString(message.cron, { verbose: false });
  } catch {
    return "Invalid schedule";
  }
}

function toEditable(message: ScheduledMessageRow): EditableMessage {
  return {
    id: message.id,
    recipientType: message.recipientType,
    recipient: message.recipient,
    recipientName: message.recipientName,
    body: message.body,
    scheduleKind: message.scheduleKind,
    runAt: message.runAt,
    cron: message.cron,
    timezone: message.timezone,
    templateId: message.templateId,
    enabled: message.enabled
  };
}

export function MessagesPage() {
  const { data: messages, isLoading } = useMessages();
  const toggle = useToggleMessage();
  const remove = useDeleteMessage();

  const [editing, setEditing] = useState<EditableMessage | null>(null);
  const [creating, setCreating] = useState(false);
  const [sendingNow, setSendingNow] = useState(false);
  const [deleting, setDeleting] = useState<ScheduledMessageRow | null>(null);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Scheduled messages</h1>
          <p className="text-sm text-muted-foreground">
            Manage one-time and recurring WhatsApp deliveries.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setSendingNow(true)}>
            <SendIcon className="size-4" /> Send now
          </Button>
          <Button onClick={() => setCreating(true)}>
            <PlusIcon className="size-4" /> New
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : !messages || messages.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-16 text-center">
          <SendIcon className="size-8 text-muted-foreground" />
          <div>
            <p className="font-medium">No scheduled messages yet</p>
            <p className="text-sm text-muted-foreground">
              Create your first schedule to start automating WhatsApp.
            </p>
          </div>
          <Button onClick={() => setCreating(true)}>
            <PlusIcon className="size-4" /> New schedule
          </Button>
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Recipient</TableHead>
                <TableHead>Message</TableHead>
                <TableHead>Schedule</TableHead>
                <TableHead className="w-24">Enabled</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {messages.map((message) => (
                <TableRow key={message.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {message.recipientType === "group" ? (
                        <UsersIcon className="size-4 text-muted-foreground" />
                      ) : (
                        <UserIcon className="size-4 text-muted-foreground" />
                      )}
                      <span className="font-medium">
                        {message.recipientName ?? message.recipient}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="max-w-[18rem]">
                    <p className="truncate text-sm text-muted-foreground">{message.body}</p>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="font-normal">
                      {describeSchedule(message)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={message.enabled}
                      onCheckedChange={(enabled) =>
                        toggle.mutate(
                          { id: message.id, enabled },
                          { onError: (e) => toast.error(e.message) }
                        )
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" aria-label="Row actions">
                          <MoreHorizontalIcon className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setEditing(toEditable(message))}>
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => setDeleting(message)}
                        >
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <MessageFormDialog
        open={creating || editing !== null}
        onOpenChange={(open) => {
          if (!open) {
            setCreating(false);
            setEditing(null);
          }
        }}
        message={editing}
      />

      <SendNowDialog open={sendingNow} onOpenChange={setSendingNow} />

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        title="Delete this scheduled message?"
        description="The schedule will be removed. Past deliveries stay in history."
        confirmLabel="Delete"
        destructive
        onConfirm={() => {
          if (!deleting) return;
          remove.mutate(deleting.id, {
            onSuccess: () => {
              toast.success("Schedule deleted");
              setDeleting(null);
            },
            onError: (e) => toast.error(e.message)
          });
        }}
      />
    </div>
  );
}
