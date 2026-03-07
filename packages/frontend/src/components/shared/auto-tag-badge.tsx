import { Badge } from "@/components/ui/badge";
import { Bot } from "lucide-react";

const AUTO_PREFIX = "auto:";

export function isAutoTag(tag: string): boolean {
  return tag.startsWith(AUTO_PREFIX);
}

export function displayTagName(tag: string): string {
  if (!isAutoTag(tag)) return tag;
  return tag.slice(AUTO_PREFIX.length).replace(/_/g, " ");
}

export function AutoTagBadge({ tag }: { tag: string }) {
  const auto = isAutoTag(tag);

  return (
    <Badge
      variant={auto ? "outline" : "secondary"}
      className={
        auto
          ? "border-blue-300 text-blue-700 dark:border-blue-700 dark:text-blue-300"
          : ""
      }
    >
      {auto && <Bot className="mr-1 h-3 w-3" />}
      {displayTagName(tag)}
    </Badge>
  );
}
