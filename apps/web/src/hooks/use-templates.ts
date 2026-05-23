import type { TemplateInput } from "@pkg/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { client } from "@/lib/api";

const TEMPLATES_KEY = ["templates"] as const;

export function useTemplates() {
  return useQuery({
    queryKey: TEMPLATES_KEY,
    queryFn: async () => {
      const res = await client.templates.$get();
      if (!res.ok) throw new Error("Failed to load templates");
      return res.json();
    }
  });
}

export function useCreateTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: TemplateInput) => {
      const res = await client.templates.$post({ json: input });
      if (!res.ok) throw new Error("Failed to create the template");
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: TEMPLATES_KEY })
  });
}

export function useUpdateTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: TemplateInput }) => {
      const res = await client.templates[":id"].$put({ param: { id }, json: input });
      if (!res.ok) throw new Error("Failed to update the template");
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: TEMPLATES_KEY })
  });
}

export function useDeleteTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await client.templates[":id"].$delete({ param: { id } });
      if (!res.ok) throw new Error("Failed to delete the template");
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: TEMPLATES_KEY })
  });
}
