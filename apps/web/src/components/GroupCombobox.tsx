import { Check, ChevronsUpDown, Loader2, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList
} from "./ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";

type Group = {
  id: string;
  name: string;
};

type GroupComboboxProps = {
  value: string;
  onChange: (value: string) => void;
  groups: Group[];
  loading?: boolean;
};

export function GroupCombobox({ value, onChange, groups, loading = false }: GroupComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filteredGroups = useMemo(() => {
    if (!search) return groups;
    const lower = search.toLowerCase();
    return groups.filter((g) => g.name.toLowerCase().includes(lower));
  }, [groups, search]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          aria-expanded={open}
          className="w-full justify-between font-normal h-9"
          type="button"
        >
          <span className="flex items-center gap-2 truncate">
            <Users className="h-4 w-4 shrink-0 text-muted-foreground" />
            {value ? (
              <span className="truncate">{value}</span>
            ) : (
              <span className="text-muted-foreground">Search or enter group name...</span>
            )}
          </span>
          {loading ? (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
          ) : (
            <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Search groups..." value={search} onValueChange={setSearch} />
          <CommandList>
            {filteredGroups.length === 0 && !loading ? (
              <CommandEmpty>
                {search ? (
                  <button
                    type="button"
                    className="w-full px-2 py-1.5 text-left text-sm hover:bg-accent rounded-sm"
                    onClick={() => {
                      onChange(search);
                      setOpen(false);
                      setSearch("");
                    }}
                  >
                    Use "<span className="font-medium">{search}</span>" as group name
                  </button>
                ) : (
                  <span className="text-muted-foreground text-xs">No groups found</span>
                )}
              </CommandEmpty>
            ) : null}
            <CommandGroup>
              {filteredGroups.map((group) => (
                <CommandItem
                  key={group.id}
                  value={group.name}
                  onSelect={() => {
                    onChange(group.name);
                    setOpen(false);
                    setSearch("");
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4 shrink-0",
                      value.toLowerCase() === group.name.toLowerCase() ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <span className="truncate">{group.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
