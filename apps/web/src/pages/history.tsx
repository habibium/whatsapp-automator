import type { DeliveryStatus } from "@pkg/shared";
import { format } from "date-fns";
import { ChevronLeftIcon, ChevronRightIcon, InboxIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { useDeliveries } from "@/hooks/use-deliveries";
import { cn } from "@/lib/utils";

const LIMIT = 25;

const STATUS_STYLES: Record<DeliveryStatus, string> = {
  sent: "bg-green-500/10 text-green-700 dark:text-green-400",
  failed: "bg-destructive/10 text-destructive",
  pending: "bg-amber-500/10 text-amber-700 dark:text-amber-400"
};

function StatusPill({ status }: { status: DeliveryStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium capitalize",
        STATUS_STYLES[status]
      )}
    >
      {status}
    </span>
  );
}

export function HistoryPage() {
  const [offset, setOffset] = useState(0);
  const { data, isLoading, isFetching } = useDeliveries({ limit: LIMIT, offset });

  const total = data?.total ?? 0;
  const items = data?.items ?? [];
  const hasNext = offset + LIMIT < total;
  const hasPrev = offset > 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Delivery history</h1>
        <p className="text-sm text-muted-foreground">
          Every message sent through WA Scheduler — scheduled or ad-hoc.
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-16 text-center">
          <InboxIcon className="size-8 text-muted-foreground" />
          <div>
            <p className="font-medium">Nothing delivered yet</p>
            <p className="text-sm text-muted-foreground">
              Send a message or wait for a schedule to fire.
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">Status</TableHead>
                  <TableHead>Recipient</TableHead>
                  <TableHead>Message</TableHead>
                  <TableHead className="w-44">When</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <StatusPill status={item.status} />
                    </TableCell>
                    <TableCell className="font-medium">
                      {item.recipientName ?? item.recipient}
                    </TableCell>
                    <TableCell className="max-w-[24rem]">
                      <p className="truncate text-sm text-muted-foreground" title={item.body}>
                        {item.body}
                      </p>
                      {item.error ? (
                        <p className="truncate text-xs text-destructive" title={item.error}>
                          {item.error}
                        </p>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(item.sentAt ?? item.createdAt), "PPp")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {offset + 1}–{Math.min(offset + items.length, total)} of {total}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={!hasPrev || isFetching}
                onClick={() => setOffset((value) => Math.max(0, value - LIMIT))}
              >
                <ChevronLeftIcon className="size-4" /> Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!hasNext || isFetching}
                onClick={() => setOffset((value) => value + LIMIT)}
              >
                Next <ChevronRightIcon className="size-4" />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
