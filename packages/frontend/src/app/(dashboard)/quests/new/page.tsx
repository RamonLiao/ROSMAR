'use client';

import { useRouter } from 'next/navigation';
import { QuestBuilder } from '@/components/quest/quest-builder';
import { useCreateQuest } from '@/lib/hooks/use-quests';

export default function NewQuestPage() {
  const router = useRouter();
  const createQuest = useCreateQuest();

  const handleSubmit = async (data: Parameters<typeof createQuest.mutateAsync>[0]) => {
    await createQuest.mutateAsync({
      ...data,
      steps: data.steps.map((s, i) => ({
        ...s,
        orderIndex: i,
      })),
    });
    router.push('/quests');
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Create Quest</h1>
      <QuestBuilder onSubmit={handleSubmit} isPending={createQuest.isPending} />
    </div>
  );
}
