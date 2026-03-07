'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { Quest } from '@/lib/hooks/use-quests';

interface QuestListProps {
  quests: Quest[];
  onSelect?: (quest: Quest) => void;
}

export function QuestList({ quests, onSelect }: QuestListProps) {
  if (quests.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        No quests yet. Create your first quest to get started.
      </p>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {quests.map((quest) => (
        <Card
          key={quest.id}
          className="cursor-pointer hover:border-primary/50 transition-colors"
          onClick={() => onSelect?.(quest)}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base truncate">{quest.name}</CardTitle>
            <Badge variant={quest.isActive ? 'default' : 'secondary'}>
              {quest.isActive ? 'Active' : 'Inactive'}
            </Badge>
          </CardHeader>
          <CardContent>
            {quest.description && (
              <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                {quest.description}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              {quest.steps?.length ?? 0} step{(quest.steps?.length ?? 0) !== 1 ? 's' : ''}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
