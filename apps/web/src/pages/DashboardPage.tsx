import {
  AlertTriangle,
  BarChart3,
  ChevronRight,
  Inbox,
  Link2,
  MessageSquareText,
  Plus,
  User,
  Users
} from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { describeCron } from "../components/CronScheduleBuilder";
import { Alert, AlertDescription, AlertTitle } from "../components/ui/alert";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Skeleton } from "../components/ui/skeleton";
import { useMessages } from "../hooks/useMessages";
import { useWhatsApp } from "../hooks/useWhatsApp";

function StatusText({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    connected: { label: "Connected", className: "text-green-500" },
    disconnected: { label: "Disconnected", className: "text-red-500" },
    connecting: { label: "Connecting...", className: "text-yellow-500" },
    awaiting_qr: { label: "Awaiting QR", className: "text-yellow-500" }
  };
  const s = map[status] ?? { label: status, className: "text-muted-foreground" };
  return <span className={cn("text-2xl font-bold capitalize", s.className)}>{s.label}</span>;
}

export function DashboardPage() {
  const { status } = useWhatsApp();
  const { messages, loading } = useMessages();

  const enabledCount = messages.filter((m) => m.enabled).length;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-muted-foreground">Overview of your WhatsApp scheduler</p>
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              WhatsApp Status
            </CardTitle>
            <Link2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <StatusText status={status} />
            {status !== "connected" ? (
              <Link
                to="/connect"
                className="mt-2 flex items-center text-xs text-primary hover:underline"
              >
                Connect <ChevronRight className="ml-0.5 h-3 w-3" />
              </Link>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active Schedules
            </CardTitle>
            <MessageSquareText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-12" />
            ) : (
              <span className="text-2xl font-bold">{enabledCount}</span>
            )}
            <Link
              to="/messages"
              className="mt-2 flex items-center text-xs text-primary hover:underline"
            >
              Manage <ChevronRight className="ml-0.5 h-3 w-3" />
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Messages
            </CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-12" />
            ) : (
              <span className="text-2xl font-bold">{messages.length}</span>
            )}
            <Link
              to="/messages/new"
              className="mt-2 flex items-center text-xs text-primary hover:underline"
            >
              Create new <ChevronRight className="ml-0.5 h-3 w-3" />
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Warning alert */}
      {status !== "connected" ? (
        <Alert
          variant="destructive"
          className="border-yellow-500/30 bg-yellow-500/5 text-yellow-200 [&>svg]:text-yellow-500"
        >
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>WhatsApp Not Connected</AlertTitle>
          <AlertDescription className="flex items-center justify-between">
            <span className="text-yellow-200/80">
              Connect your WhatsApp account to start sending scheduled messages.
            </span>
            <Button size="sm" asChild className="ml-4 shrink-0">
              <Link to="/connect">Connect Now</Link>
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      {/* Empty state */}
      {messages.length === 0 && !loading ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Inbox className="h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-semibold">No Scheduled Messages</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Create your first scheduled message to get started.
            </p>
            <Button asChild className="mt-4">
              <Link to="/messages/new">
                <Plus className="mr-2 h-4 w-4" />
                Create Message
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {/* Recent messages */}
      {messages.length > 0 ? (
        <div>
          <h2 className="mb-4 text-lg font-semibold">Recent Schedules</h2>
          <Card>
            <CardContent className="divide-y divide-border p-0">
              {messages.slice(0, 5).map((msg) => (
                <Link
                  to={`/messages/${msg.id}`}
                  key={msg.id}
                  className="flex items-center justify-between px-4 py-3 transition-colors hover:bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    {msg.isGroup ? (
                      <Users className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <User className="h-4 w-4 text-muted-foreground" />
                    )}
                    <div>
                      <p className="text-sm font-medium">{msg.target}</p>
                      <p className="text-xs text-muted-foreground">
                        {describeCron(msg.cronExpression)}
                      </p>
                    </div>
                  </div>
                  <Badge variant={msg.enabled ? "default" : "secondary"}>
                    {msg.enabled ? "Active" : "Paused"}
                  </Badge>
                </Link>
              ))}
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
