import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DollarSign, ExternalLink } from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useRouter } from "next/navigation";
import { useRef } from "react";

interface DealCardProps {
  id: string;
  title: string;
  value?: number;
  stage: string;
  profileName?: string;
  probability?: number;
  notes?: string | null;
}

export function DealCard({
  id,
  title,
  value,
  stage,
  profileName,
  probability,
  notes,
}: DealCardProps) {
  const router = useRouter();
  const pointerStart = useRef<{ x: number; y: number } | null>(null);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  // Distinguish click from drag: record pointer start, check distance on up
  const handlePointerDown = (e: React.PointerEvent) => {
    pointerStart.current = { x: e.clientX, y: e.clientY };
    listeners?.onPointerDown?.(e as unknown as React.PointerEvent<Element>);
  };

  const handleClick = (e: React.MouseEvent) => {
    if (!pointerStart.current) return;
    const dx = e.clientX - pointerStart.current.x;
    const dy = e.clientY - pointerStart.current.y;
    // Only navigate if pointer barely moved (not a drag)
    if (Math.abs(dx) < 5 && Math.abs(dy) < 5) {
      router.push(`/deals/${id}`);
    }
    pointerStart.current = null;
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onPointerDown={handlePointerDown}
      onClick={handleClick}
      className={`cursor-grab active:cursor-grabbing bg-white/80 dark:bg-white/[0.06] shadow-sm hover:shadow-md hover:border-primary/20 !translate-y-0 transition-all duration-200 ${
        isDragging ? "shadow-lg scale-105 z-50" : ""
      }`}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <h4 className="font-semibold">{title}</h4>
          <ExternalLink className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {value && (
          <div className="flex items-center gap-2 text-sm">
            <DollarSign className="h-4 w-4 text-green-600" />
            <span className="font-medium">
              ${value.toLocaleString()}
            </span>
          </div>
        )}
        {profileName && (
          <p className="text-sm text-muted-foreground break-all" title={profileName}>{profileName}</p>
        )}
        {notes && (
          <p className="text-xs text-muted-foreground line-clamp-2">{notes}</p>
        )}
        {probability !== undefined && (
          <div className="text-sm">
            <span className="text-muted-foreground">Probability: </span>
            <span className="font-medium">{probability}%</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
