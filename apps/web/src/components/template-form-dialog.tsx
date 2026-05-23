import { type TemplateInput, templateInputSchema } from "@pkg/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useCreateTemplate, useUpdateTemplate } from "@/hooks/use-templates";

export type EditableTemplate = { id: string; name: string; body: string };

type TemplateFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: EditableTemplate | null;
};

export function TemplateFormDialog({ open, onOpenChange, template }: TemplateFormDialogProps) {
  const create = useCreateTemplate();
  const update = useUpdateTemplate();

  const form = useForm<TemplateInput>({
    resolver: zodResolver(templateInputSchema),
    values: template ? { name: template.name, body: template.body } : { name: "", body: "" }
  });

  const isEditing = Boolean(template);

  async function onSubmit(values: TemplateInput) {
    try {
      if (template) {
        await update.mutateAsync({ id: template.id, input: values });
        toast.success("Template updated");
      } else {
        await create.mutateAsync(values);
        toast.success("Template created");
      }
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit template" : "New template"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Friday recap" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="body"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Body</FormLabel>
                  <FormControl>
                    <Textarea rows={6} placeholder="Hello…" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? "Saving…" : isEditing ? "Save" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
