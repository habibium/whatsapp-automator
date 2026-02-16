import {
  CalendarClock,
  CheckCircle,
  ChevronDown,
  HelpCircle,
  Loader2,
  LogOut,
  Smartphone,
  Unplug,
  Wifi
} from "lucide-react";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuthStore } from "../stores/auth";
import { useWhatsAppStore } from "../stores/whatsapp";
import { Avatar, AvatarFallback } from "./ui/avatar";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "./ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";

function ConnectionStatusButton() {
  const { status, qrCode, loading, connect, disconnect } = useWhatsAppStore();

  useEffect(() => {
    useWhatsAppStore.getState().fetchStatus();
    return () => useWhatsAppStore.getState().cleanup();
  }, []);

  const isConnected = status === "connected";

  const handleConnect = () => {
    if (status !== "connected" && !loading) {
      connect();
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="gap-2 text-sm font-medium"
          onClick={handleConnect}
        >
          <span
            className={cn(
              "h-2 w-2 rounded-full",
              isConnected ? "bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.5)]" : "bg-red-500/70"
            )}
          />
          <span className="hidden sm:inline">{isConnected ? "Connected" : "Disconnected"}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex flex-col items-center px-5 py-6">
          {status === "connected" ? (
            <>
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-500/10">
                <CheckCircle className="h-7 w-7 text-green-500" />
              </div>
              <h3 className="mt-3 text-base font-semibold">Connected</h3>
              <p className="mt-1 text-center text-xs text-muted-foreground">
                Your WhatsApp account is linked and ready.
              </p>
              <Button
                variant="destructive"
                size="sm"
                className="mt-4"
                onClick={disconnect}
                disabled={loading}
              >
                <Unplug className="mr-2 h-3.5 w-3.5" />
                Disconnect
              </Button>
            </>
          ) : status === "awaiting_qr" && qrCode ? (
            <>
              <div className="rounded-xl border border-border bg-white p-2.5">
                <img src={qrCode} alt="WhatsApp QR Code" className="h-48 w-48" />
              </div>
              <h3 className="mt-4 text-base font-semibold">Scan QR Code</h3>
              <p className="mt-1 max-w-xs text-center text-xs text-muted-foreground">
                Open WhatsApp &rarr;{" "}
                <span className="font-medium text-foreground">
                  Settings &rarr; Linked Devices &rarr; Link a Device
                </span>
              </p>
            </>
          ) : (
            <>
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <h3 className="mt-3 text-base font-semibold">
                {status === "connecting" ? "Connecting..." : "Loading..."}
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Please wait while we establish the connection.
              </p>
            </>
          )}
        </div>

        {/* Help tips */}
        <div className="border-t border-border px-5 py-4">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <HelpCircle className="h-3.5 w-3.5" />
            Tips
          </div>
          <ul className="mt-2 space-y-1.5 text-xs text-muted-foreground">
            <li className="flex items-start gap-1.5">
              <Smartphone className="mt-0.5 h-3 w-3 shrink-0" />
              Phone must have an active internet connection
            </li>
            <li className="flex items-start gap-1.5">
              <Wifi className="mt-0.5 h-3 w-3 shrink-0" />
              Keep WhatsApp open during the scan
            </li>
            <li className="flex items-start gap-1.5">
              <CheckCircle className="mt-0.5 h-3 w-3 shrink-0" />
              Session stays active until you disconnect
            </li>
          </ul>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function UserMenu() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const initials = user?.email ? user.email.slice(0, 2).toUpperCase() : "??";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2 pl-1.5">
          <Avatar className="h-7 w-7">
            <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
              {initials}
            </AvatarFallback>
          </Avatar>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <p className="truncate text-sm font-medium">{user?.email}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={handleLogout}
          className="text-destructive-foreground focus:text-destructive-foreground"
        >
          <LogOut className="mr-2 h-4 w-4" />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function Header() {
  return (
    <header className="sticky top-0 z-50 flex h-14 items-center justify-between border-b border-border bg-background/80 px-4 backdrop-blur-sm sm:px-6">
      {/* Left: Logo + Name */}
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
          <CalendarClock className="h-4.5 w-4.5 text-primary-foreground" />
        </div>
        <span className="text-base font-semibold tracking-tight">WA Scheduler</span>
      </div>

      {/* Right: Connection Status + Avatar */}
      <div className="flex items-center gap-1">
        <ConnectionStatusButton />
        <UserMenu />
      </div>
    </header>
  );
}
