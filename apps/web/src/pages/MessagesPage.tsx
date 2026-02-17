import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable
} from "@tanstack/react-table";
import {
  AlertCircle,
  ArrowUpDown,
  Inbox,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  Unplug,
  User,
  Users
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { describeCron } from "../components/CronScheduleBuilder";
import { Alert, AlertDescription, AlertTitle } from "../components/ui/alert";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "../components/ui/dialog";
import { Skeleton } from "../components/ui/skeleton";
import { Switch } from "../components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "../components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "../components/ui/tooltip";
import type { ScheduledMessage } from "../lib/api";
import { useDeleteMessage, useMessages, useToggleMessage } from "../lib/queries";
import { useWhatsAppStore } from "../stores/whatsapp";

function TableSkeleton() {
  return (
    <Card className="py-0">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Target</TableHead>
            <TableHead>Message</TableHead>
            <TableHead>Schedule</TableHead>
            <TableHead className="text-center">Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 5 }).map((_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: skeleton rows have no stable id
            <TableRow key={i}>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-4 rounded" />
                  <Skeleton className="h-4 w-24" />
                </div>
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-40" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-28" />
              </TableCell>
              <TableCell>
                <div className="flex justify-center">
                  <Skeleton className="h-5 w-9 rounded-full" />
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center justify-end gap-1">
                  <Skeleton className="h-8 w-8 rounded" />
                  <Skeleton className="h-8 w-8 rounded" />
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

export function MessagesPage() {
  const { data: messages = [], isLoading, error } = useMessages();
  const toggleMutation = useToggleMessage();
  const deleteMutation = useDeleteMessage();
  const whatsappStatus = useWhatsAppStore((s) => s.status);
  const whatsappLoading = useWhatsAppStore((s) => s.loading);

  const isConnected = whatsappStatus === "connected";
  const showDisconnectedBanner = !isConnected && !whatsappLoading;

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [sorting, setSorting] = useState<SortingState>([]);

  const handleDelete = () => {
    if (!deleteId) return;
    deleteMutation.mutate(deleteId, {
      onSettled: () => setDeleteId(null)
    });
  };

  const columns = useMemo<ColumnDef<ScheduledMessage>[]>(
    () => [
      {
        accessorKey: "target",
        header: ({ column }) => (
          <Button
            variant="ghost"
            size="sm"
            className="h-8"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Target
            <ArrowUpDown className="size-3.5" />
          </Button>
        ),
        cell: ({ row }) => {
          const msg = row.original;
          return (
            <div className="flex items-center gap-2">
              {msg.isGroup ? (
                <Users className="size-4 shrink-0 text-muted-foreground" />
              ) : (
                <User className="size-4 shrink-0 text-muted-foreground" />
              )}
              <span className="font-medium">{msg.target}</span>
            </div>
          );
        }
      },
      {
        accessorKey: "message",
        header: "Message",
        cell: ({ row }) => (
          <span className="line-clamp-1 max-w-50 text-muted-foreground">
            {row.original.message}
          </span>
        ),
        enableSorting: false
      },
      {
        accessorKey: "cronExpression",
        header: ({ column }) => (
          <Button
            variant="ghost"
            size="sm"
            className="-ml-3 h-8"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Schedule
            <ArrowUpDown className="size-3.5" />
          </Button>
        ),
        cell: ({ row }) => (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="cursor-default text-sm text-foreground">
                {describeCron(row.original.cronExpression)}
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <code className="font-mono text-xs">{row.original.cronExpression}</code>
            </TooltipContent>
          </Tooltip>
        )
      },
      {
        accessorKey: "enabled",
        header: ({ column }) => (
          <div className="text-center">
            <Button
              variant="ghost"
              size="sm"
              className="h-8"
              onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            >
              Status
              <ArrowUpDown className="size-3.5" />
            </Button>
          </div>
        ),
        cell: ({ row }) => {
          const msg = row.original;
          return (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex justify-center">
                  <Switch
                    checked={msg.enabled}
                    disabled={!isConnected}
                    onCheckedChange={() =>
                      toggleMutation.mutate({ id: msg.id, enabled: !msg.enabled })
                    }
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent>
                {!isConnected ? "Connect WhatsApp first" : msg.enabled ? "Disable" : "Enable"}
              </TooltipContent>
            </Tooltip>
          );
        }
      },
      {
        id: "actions",
        header: () => <div className="text-right">Actions</div>,
        cell: ({ row }) => {
          const msg = row.original;
          return (
            <div className="flex items-center justify-end gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" asChild disabled={!isConnected}>
                    <Link
                      to={isConnected ? `/messages/${msg.id}` : "#"}
                      onClick={(e) => {
                        if (!isConnected) e.preventDefault();
                      }}
                      aria-disabled={!isConnected}
                    >
                      <Pencil className="h-4 w-4" />
                    </Link>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{isConnected ? "Edit" : "Connect WhatsApp first"}</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive-foreground hover:bg-destructive/10"
                    onClick={() => setDeleteId(msg.id)}
                    disabled={!isConnected}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{isConnected ? "Delete" : "Connect WhatsApp first"}</TooltipContent>
              </Tooltip>
            </div>
          );
        },
        enableSorting: false
      }
    ],
    [toggleMutation, isConnected]
  );

  const table = useReactTable({
    data: messages,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel()
  });

  return (
    <div className="space-y-6">
      {/* Disconnected Banner */}
      {showDisconnectedBanner && (
        <div className="flex items-center gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-500/10">
            <Unplug className="h-4 w-4 text-amber-500" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground">WhatsApp not connected</p>
            <p className="text-xs text-muted-foreground">
              Connect your WhatsApp to create, edit, or manage scheduled messages.
            </p>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Scheduled Messages</h1>
          <p className="mt-1 text-muted-foreground">Manage your automated WhatsApp messages</p>
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <span tabIndex={!isConnected ? 0 : undefined}>
              <Button asChild={isConnected} disabled={!isConnected}>
                {isConnected ? (
                  <Link to="/messages/new">
                    <Plus className="size-4" />
                    New Message
                  </Link>
                ) : (
                  <>
                    <Plus className="size-4" />
                    New Message
                  </>
                )}
              </Button>
            </span>
          </TooltipTrigger>
          {!isConnected && (
            <TooltipContent>Connect WhatsApp first to create messages</TooltipContent>
          )}
        </Tooltip>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Failed to load messages</AlertTitle>
          <AlertDescription>
            Something went wrong while fetching your messages. Please try again.
          </AlertDescription>
        </Alert>
      ) : isLoading ? (
        <TableSkeleton />
      ) : messages.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Inbox className="h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-semibold">No Scheduled Messages</h3>
            <p className="mt-1 text-center text-sm text-muted-foreground">
              {isConnected
                ? "Create your first scheduled message to start automating your WhatsApp communications."
                : "Connect your WhatsApp account first, then create scheduled messages."}
            </p>
            {isConnected ? (
              <Button asChild className="mt-4">
                <Link to="/messages/new">
                  <Plus className="mr-2 h-4 w-4" />
                  Create Message
                </Link>
              </Button>
            ) : (
              <Button className="mt-4" disabled>
                <Plus className="mr-2 h-4 w-4" />
                Create Message
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card className="py-0">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id} colSpan={header.colSpan}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Delete confirmation dialog */}
      <Dialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete scheduled message?</DialogTitle>
            <DialogDescription>
              This action cannot be undone. The scheduled message will be permanently deleted.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteId(null)}
              disabled={deleteMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
