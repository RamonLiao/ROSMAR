"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useUiStore } from "@/stores/ui-store";
import { apiClient } from "@/lib/api/client";

interface SearchResult {
  id: string;
  type: "profile" | "organization" | "deal" | "ticket";
  title: string;
  subtitle?: string;
}

export function CommandPalette() {
  const router = useRouter();
  const { commandPaletteOpen, toggleCommandPalette } = useUiStore();
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        toggleCommandPalette();
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [toggleCommandPalette]);

  useEffect(() => {
    if (!search || search.length < 2) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const data = await apiClient.get<{ results: SearchResult[] }>(
          `/api/search?q=${encodeURIComponent(search)}`
        );
        setResults(data.results);
      } catch (error) {
        console.error("Search error:", error);
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [search]);

  const handleSelect = (result: SearchResult) => {
    toggleCommandPalette();
    router.push(`/${result.type}s/${result.id}`);
  };

  return (
    <CommandDialog open={commandPaletteOpen} onOpenChange={toggleCommandPalette}>
      <CommandInput
        placeholder="Search profiles, deals, organizations..."
        value={search}
        onValueChange={setSearch}
      />
      <CommandList>
        {isLoading ? (
          <div className="py-6 text-center text-sm">Searching...</div>
        ) : (
          <>
            <CommandEmpty>No results found.</CommandEmpty>
            {results.length > 0 && (
              <CommandGroup heading="Results">
                {results.map((result) => (
                  <CommandItem
                    key={`${result.type}-${result.id}`}
                    onSelect={() => handleSelect(result)}
                  >
                    <div className="flex flex-col">
                      <span>{result.title}</span>
                      {result.subtitle && (
                        <span className="text-sm text-muted-foreground">
                          {result.subtitle}
                        </span>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
