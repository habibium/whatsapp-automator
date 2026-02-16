import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  type CreateMessageInput,
  getErrorMessage,
  messagesApi,
  serverApi,
  type UpdateMessageInput,
  whatsappApi
} from "./api";

// ── Query Keys ─────────────────────────────────────────────────────

export const queryKeys = {
  messages: {
    all: ["messages"] as const,
    detail: (id: string) => ["messages", id] as const
  },
  whatsapp: {
    groups: ["whatsapp", "groups"] as const
  },
  server: {
    timezone: ["server", "timezone"] as const
  }
} as const;

// ── Messages ───────────────────────────────────────────────────────

export function useMessages() {
  return useQuery({
    queryKey: queryKeys.messages.all,
    queryFn: messagesApi.list
  });
}

export function useMessage(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.messages.detail(id!),
    queryFn: () => messagesApi.get(id!),
    enabled: Boolean(id)
  });
}

export function useCreateMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateMessageInput) => messagesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.messages.all });
      toast.success("Schedule created successfully");
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    }
  });
}

export function useUpdateMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateMessageInput }) =>
      messagesApi.update(id, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.messages.all });
      queryClient.invalidateQueries({
        queryKey: queryKeys.messages.detail(variables.id)
      });
      toast.success("Schedule updated successfully");
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    }
  });
}

export function useDeleteMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => messagesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.messages.all });
      toast.success("Schedule deleted");
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    }
  });
}

export function useToggleMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      messagesApi.update(id, { enabled }),
    onMutate: async ({ id, enabled }) => {
      // Optimistic update
      await queryClient.cancelQueries({ queryKey: queryKeys.messages.all });
      const previous = queryClient.getQueryData(queryKeys.messages.all);
      queryClient.setQueryData(
        queryKeys.messages.all,
        (old: Awaited<ReturnType<typeof messagesApi.list>> | undefined) =>
          old?.map((m) => (m.id === id ? { ...m, enabled } : m))
      );
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.messages.all, context.previous);
      }
      toast.error("Failed to update status");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.messages.all });
    }
  });
}

// ── Server Info ────────────────────────────────────────────────────

export function useServerTimezone() {
  return useQuery({
    queryKey: queryKeys.server.timezone,
    queryFn: serverApi.timezone,
    staleTime: 60 * 60 * 1000, // 1 hour
    retry: 1
  });
}

// ── WhatsApp Groups ────────────────────────────────────────────────

export function useWhatsAppGroups(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.whatsapp.groups,
    queryFn: whatsappApi.groups,
    enabled,
    staleTime: 5 * 60 * 1000 // 5 minutes
  });
}
