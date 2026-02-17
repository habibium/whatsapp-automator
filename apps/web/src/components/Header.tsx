import {
  CalendarClock,
  CheckCircle,
  ChevronDown,
  HelpCircle,
  Loader2,
  LogOut,
  Monitor,
  Moon,
  RefreshCw,
  Smartphone,
  Sun,
  Unplug,
  Wifi
} from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuthStore } from "../stores/auth";
import { useWhatsAppStore } from "../stores/whatsapp";
import { Avatar, AvatarFallback } from "./ui/avatar";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "./ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";

function ThemeSegmentedControl() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const currentTheme = mounted ? (theme ?? "system") : "system";

  const options = [
    { value: "light", icon: Sun, label: "Light" },
    { value: "dark", icon: Moon, label: "Dark" },
    { value: "system", icon: Monitor, label: "System" }
  ] as const;

  return (
    <div className="mx-2 rounded-lg border border-border bg-muted/50">
      <div className="grid grid-cols-3 gap-1">
        {options.map((option) => {
          const Icon = option.icon;
          const isActive = currentTheme === option.value;

          return (
            <Button
              key={option.value}
              type="button"
              size={"sm"}
              aria-label={option.label}
              onClick={() => setTheme(option.value)}
              variant={isActive ? "default" : "ghost"}
            >
              <Icon className="size-4" />
            </Button>
          );
        })}
      </div>
    </div>
  );
}

function ConnectionStatusButton() {
  const { status, qrCode, loading, connect, disconnect, logout } = useWhatsAppStore();

  useEffect(() => {
    useWhatsAppStore.getState().fetchStatus();
    return () => useWhatsAppStore.getState().cleanup();
  }, []);

  const isConnected = status === "connected";
  const isConnecting = status === "connecting" || (loading && status === "disconnected");
  const isAwaitingQR = status === "awaiting_qr";

  const handleConnect = () => {
    if (!isConnected && !loading) {
      connect();
    }
  };

  const statusLabel = isConnected
    ? "Connected"
    : isAwaitingQR
      ? "Scan QR"
      : isConnecting
        ? "Connecting"
        : "Disconnected";

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-2 text-sm font-medium"
          onClick={handleConnect}
        >
          <span
            className={cn(
              "h-2 w-2 rounded-full transition-colors",
              isConnected
                ? "bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.5)]"
                : isConnecting || isAwaitingQR
                  ? "animate-pulse bg-amber-500"
                  : "bg-red-500/70"
            )}
          />
          <span className="hidden sm:inline">{statusLabel}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex flex-col items-center px-5 py-6">
          {isConnected ? (
            <>
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-500/10">
                <CheckCircle className="h-7 w-7 text-green-500" />
              </div>
              <h3 className="mt-3 text-base font-semibold">Connected</h3>
              <p className="mt-1 text-center text-xs text-muted-foreground">
                Your WhatsApp account is linked and ready.
              </p>
              <div className="mt-4 flex gap-2">
                <Button variant="outline" size="sm" onClick={disconnect} disabled={loading}>
                  {loading ? (
                    <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Unplug className="mr-2 h-3.5 w-3.5" />
                  )}
                  Disconnect
                </Button>
                <Button variant="destructive" size="sm" onClick={logout} disabled={loading}>
                  {loading ? (
                    <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <LogOut className="mr-2 h-3.5 w-3.5" />
                  )}
                  Logout
                </Button>
              </div>
              <p className="mt-3 text-center text-[11px] text-muted-foreground">
                <strong>Disconnect</strong> keeps session &middot; <strong>Logout</strong> unlinks
                device
              </p>
            </>
          ) : isAwaitingQR && qrCode ? (
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
          ) : status === "disconnected" && !loading ? (
            <>
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-500/10">
                <Unplug className="h-7 w-7 text-red-500/70" />
              </div>
              <h3 className="mt-3 text-base font-semibold">Disconnected</h3>
              <p className="mt-1 text-center text-xs text-muted-foreground">
                Connect to start sending scheduled messages.
              </p>
              <Button size="sm" className="mt-4" onClick={handleConnect}>
                <RefreshCw className="mr-2 h-3.5 w-3.5" />
                Connect
              </Button>
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
        <DropdownMenuGroup>
          <DropdownMenuLabel>Theme</DropdownMenuLabel>
          <ThemeSegmentedControl />
        </DropdownMenuGroup>

        {/* <DropdownMenuSeparator className="mt-8" /> */}
        <DropdownMenuGroup className="mt-4">
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="font-normal">
            <p className="truncate text-sm font-medium">{user?.email}</p>
          </DropdownMenuLabel>

          <DropdownMenuItem
            onClick={handleLogout}
            className="text-destructive-foreground focus:text-destructive-foreground"
          >
            <LogOut className="size-4 text-destructive-foreground" />
            Log out
          </DropdownMenuItem>
        </DropdownMenuGroup>
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
