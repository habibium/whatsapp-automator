import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable
} from "@tanstack/react-table";
import { ArrowUpDown, Inbox, Loader2, Pencil, Plus, Trash2, User, Users } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { describeCron } from "../components/CronScheduleBuilder";
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
import { useMessagesStore } from "../stores/messages";

export function MessagesPage() {
  const { messages, loading, toggleEnabled, remove, fetch: fetchMessages } = useMessagesStore();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [sorting, setSorting] = useState<SortingState>([]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  const handleToggle = useCallback(
    async (id: string, currentEnabled: boolean) => {
      await toggleEnabled(id, !currentEnabled);
    },
    [toggleEnabled]
  );

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    await remove(deleteId);
    setDeleting(false);
    setDeleteId(null);
  };

  const columns = useMemo<ColumnDef<ScheduledMessage>[]>(
    () => [
      {
        accessorKey: "target",
        header: ({ column }) => (
          <Button
            variant="ghost"
            size="sm"
            className="-ml-3 h-8"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Target
            <ArrowUpDown className="ml-1.5 h-3.5 w-3.5" />
          </Button>
        ),
        cell: ({ row }) => {
          const msg = row.original;
          return (
            <div className="flex items-center gap-2">
              {msg.isGroup ? (
                <Users className="h-4 w-4 shrink-0 text-muted-foreground" />
              ) : (
                <User className="h-4 w-4 shrink-0 text-muted-foreground" />
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
            <ArrowUpDown className="ml-1.5 h-3.5 w-3.5" />
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
              <ArrowUpDown className="ml-1.5 h-3.5 w-3.5" />
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
                    onCheckedChange={() => handleToggle(msg.id, msg.enabled)}
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent>{msg.enabled ? "Disable" : "Enable"}</TooltipContent>
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
                  <Button variant="ghost" size="icon" asChild>
                    <Link to={`/messages/${msg.id}`}>
                      <Pencil className="h-4 w-4" />
                    </Link>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Edit</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive-foreground hover:bg-destructive/10"
                    onClick={() => setDeleteId(msg.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Delete</TooltipContent>
              </Tooltip>
            </div>
          );
        },
        enableSorting: false
      }
    ],
    [handleToggle]
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Scheduled Messages</h1>
          <p className="mt-1 text-muted-foreground">Manage your automated WhatsApp messages</p>
        </div>
        <Button asChild>
          <Link to="/messages/new">
            <Plus className="mr-2 h-4 w-4" />
            New Message
          </Link>
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : messages.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Inbox className="h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-semibold">No Scheduled Messages</h3>
            <p className="mt-1 text-center text-sm text-muted-foreground">
              Create your first scheduled message to start automating your WhatsApp communications.
            </p>
            <Button asChild className="mt-4">
              <Link to="/messages/new">
                <Plus className="mr-2 h-4 w-4" />
                Create Message
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
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
            <Button variant="outline" onClick={() => setDeleteId(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
