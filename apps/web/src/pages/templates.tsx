import { FileTextIcon, MoreHorizontalIcon, PlusIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { type EditableTemplate, TemplateFormDialog } from "@/components/template-form-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { useDeleteTemplate, useTemplates } from "@/hooks/use-templates";

type TemplateRow = NonNullable<ReturnType<typeof useTemplates>["data"]>[number];

export function TemplatesPage() {
  const { data, isLoading } = useTemplates();
  const remove = useDeleteTemplate();

  const [editing, setEditing] = useState<EditableTemplate | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<TemplateRow | null>(null);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Message templates</h1>
          <p className="text-sm text-muted-foreground">
            Save reusable message bodies and apply them when scheduling.
          </p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <PlusIcon className="size-4" /> New template
        </Button>
      </div>

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      ) : !data || data.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-16 text-center">
          <FileTextIcon className="size-8 text-muted-foreground" />
          <div>
            <p className="font-medium">No templates yet</p>
            <p className="text-sm text-muted-foreground">
              Templates make it easy to reuse the same message across schedules.
            </p>
          </div>
          <Button onClick={() => setCreating(true)}>
            <PlusIcon className="size-4" /> New template
          </Button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {data.map((template) => (
            <Card key={template.id}>
              <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
                <CardTitle className="truncate text-base">{template.name}</CardTitle>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon-sm" aria-label="Template actions">
                      <MoreHorizontalIcon className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() =>
                        setEditing({ id: template.id, name: template.name, body: template.body })
                      }
                    >
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={() => setDeleting(template)}
                    >
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </CardHeader>
              <CardContent>
                <p className="line-clamp-4 text-sm text-muted-foreground whitespace-pre-line">
                  {template.body}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <TemplateFormDialog
        open={creating || editing !== null}
        onOpenChange={(open) => {
          if (!open) {
            setCreating(false);
            setEditing(null);
          }
        }}
        template={editing}
      />

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        title="Delete this template?"
        description="Schedules already using this template will keep their saved body."
        confirmLabel="Delete"
        destructive
        onConfirm={() => {
          if (!deleting) return;
          remove.mutate(deleting.id, {
            onSuccess: () => {
              toast.success("Template deleted");
              setDeleting(null);
            },
            onError: (e) => toast.error(e.message)
          });
        }}
      />
    </div>
  );
}
