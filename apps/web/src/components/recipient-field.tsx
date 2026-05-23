import type { RecipientType } from "@pkg/shared";
import { useFormContext } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useWhatsAppGroups } from "@/hooks/use-whatsapp";

/** Shape the parent form must expose to bind a recipient picker. */
type RecipientFormShape = {
  recipientType: RecipientType;
  recipient: string;
  recipientName?: string;
};

/**
 * Picks the recipient for a message: a phone number for contacts, or a
 * WhatsApp group selected from the user's joined groups. Binds three RHF
 * fields (recipientType, recipient, recipientName) via context.
 */
export function RecipientField() {
  const form = useFormContext<RecipientFormShape>();
  const recipientType = form.watch("recipientType");
  const recipient = form.watch("recipient");
  const groups = useWhatsAppGroups(recipientType === "group");
  const error = form.formState.errors.recipient?.message;

  function setType(type: RecipientType) {
    form.setValue("recipientType", type, { shouldValidate: false });
    form.setValue("recipient", "", { shouldValidate: false });
    form.setValue("recipientName", "");
  }

  function setContact(phone: string) {
    form.setValue("recipient", phone, { shouldValidate: true });
    form.setValue("recipientName", phone);
  }

  function setGroup(jid: string) {
    const group = groups.data?.find((g) => g.id === jid);
    form.setValue("recipient", jid, { shouldValidate: true });
    form.setValue("recipientName", group?.name ?? "");
  }

  return (
    <div className="space-y-2">
      <Label>Recipient</Label>
      <Tabs value={recipientType} onValueChange={(value) => setType(value as RecipientType)}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="contact">Phone number</TabsTrigger>
          <TabsTrigger value="group">Group</TabsTrigger>
        </TabsList>
        <TabsContent value="contact" className="pt-2">
          <Input
            type="tel"
            inputMode="tel"
            placeholder="+1 555 555 0123"
            value={recipientType === "contact" ? recipient : ""}
            onChange={(event) => setContact(event.target.value)}
          />
        </TabsContent>
        <TabsContent value="group" className="pt-2">
          {groups.isLoading ? (
            <Skeleton className="h-9 w-full" />
          ) : !groups.data || groups.data.length === 0 ? (
            <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
              No groups available — link WhatsApp first.
            </p>
          ) : (
            <Select value={recipientType === "group" ? recipient : ""} onValueChange={setGroup}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a group" />
              </SelectTrigger>
              <SelectContent>
                {groups.data.map((group) => (
                  <SelectItem key={group.id} value={group.id}>
                    {group.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </TabsContent>
      </Tabs>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
