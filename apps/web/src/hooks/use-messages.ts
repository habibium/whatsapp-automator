import type { ScheduledMessageInput, SendNowInput } from "@pkg/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { client } from "@/lib/api";

const MESSAGES_KEY = ["messages"] as const;

export function useMessages() {
  return useQuery({
    queryKey: MESSAGES_KEY,
    queryFn: async () => {
      const res = await client.messages.$get();
      if (!res.ok) throw new Error("Failed to load scheduled messages");
      return res.json();
    }
  });
}

export function useCreateMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: ScheduledMessageInput) => {
      const res = await client.messages.$post({ json: input });
      if (!res.ok) throw new Error("Failed to create the scheduled message");
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: MESSAGES_KEY })
  });
}

export function useUpdateMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: ScheduledMessageInput }) => {
      const res = await client.messages[":id"].$put({ param: { id }, json: input });
      if (!res.ok) throw new Error("Failed to update the scheduled message");
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: MESSAGES_KEY })
  });
}

export function useToggleMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const res = await client.messages[":id"].$patch({ param: { id }, json: { enabled } });
      if (!res.ok) throw new Error("Failed to update the schedule");
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: MESSAGES_KEY })
  });
}

export function useDeleteMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await client.messages[":id"].$delete({ param: { id } });
      if (!res.ok) throw new Error("Failed to delete the scheduled message");
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: MESSAGES_KEY })
  });
}

export function useSendNow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: SendNowInput) => {
      const res = await client.messages["send-now"].$post({ json: input });
      if (!res.ok) throw new Error("Failed to send the message");
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["deliveries"] })
  });
}
