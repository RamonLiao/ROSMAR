'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { QuestList } from '@/components/quest/quest-list';
import { useQuests } from '@/lib/hooks/use-quests';

export default function QuestsPage() {
  const router = useRouter();
  const { data, isLoading } = useQuests('current');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Quests</h1>
        <Button onClick={() => router.push('/quests/new')}>
          Create Quest
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading quests...</p>
      ) : (
        <QuestList
          quests={data?.quests ?? []}
          onSelect={(q) => router.push(`/quests/${q.id}`)}
        />
      )}
    </div>
  );
}
