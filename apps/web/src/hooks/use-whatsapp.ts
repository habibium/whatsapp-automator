import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { client } from "@/lib/api";

const STATUS_KEY = ["whatsapp", "status"] as const;

/** Polls the WhatsApp connection status (enable `poll` on the pairing screen). */
export function useWhatsAppStatus(options?: { poll?: boolean }) {
  return useQuery({
    queryKey: STATUS_KEY,
    queryFn: async () => {
      const res = await client.whatsapp.status.$get();
      if (!res.ok) throw new Error("Failed to load WhatsApp status");
      return res.json();
    },
    refetchInterval: options?.poll ? 2000 : false
  });
}

export function useConnectWhatsApp() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await client.whatsapp.connect.$post();
      if (!res.ok) throw new Error("Failed to start the WhatsApp connection");
      return res.json();
    },
    onSuccess: (data) => queryClient.setQueryData(STATUS_KEY, data)
  });
}

export function useDisconnectWhatsApp() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await client.whatsapp.disconnect.$post();
      if (!res.ok) throw new Error("Failed to disconnect WhatsApp");
      return res.json();
    },
    onSuccess: (data) => queryClient.setQueryData(STATUS_KEY, data)
  });
}

export function useLogoutWhatsApp() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await client.whatsapp.logout.$post();
      if (!res.ok) throw new Error("Failed to unlink WhatsApp");
      return res.json();
    },
    onSuccess: (data) => queryClient.setQueryData(STATUS_KEY, data)
  });
}

/** Lists the user's WhatsApp groups — only fetched when `enabled`. */
export function useWhatsAppGroups(enabled: boolean) {
  return useQuery({
    queryKey: ["whatsapp", "groups"],
    enabled,
    staleTime: 60_000,
    queryFn: async () => {
      const res = await client.whatsapp.groups.$get();
      if (!res.ok) throw new Error("Failed to load WhatsApp groups");
      return res.json();
    }
  });
}
