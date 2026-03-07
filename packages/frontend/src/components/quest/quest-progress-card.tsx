'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { QuestStep, QuestStepCompletion } from '@/lib/hooks/use-quests';

interface QuestProgressCardProps {
  questName: string;
  steps: QuestStep[];
  completedSteps: QuestStepCompletion[];
  isCompleted: boolean;
}

export function QuestProgressCard({
  questName,
  steps,
  completedSteps,
  isCompleted,
}: QuestProgressCardProps) {
  const completedSet = new Set(completedSteps.map((s) => s.stepId));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          {questName}
          {isCompleted && (
            <span className="text-xs text-green-600 font-normal">
              Completed
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2" data-testid="quest-step-checklist">
          {steps
            .sort((a, b) => a.orderIndex - b.orderIndex)
            .map((step) => {
              const done = completedSet.has(step.id);
              return (
                <li
                  key={step.id}
                  className="flex items-center gap-2 text-sm"
                  data-testid={`step-${step.id}`}
                >
                  <span
                    className={`w-4 h-4 rounded-sm border flex items-center justify-center ${
                      done
                        ? 'bg-primary border-primary text-primary-foreground'
                        : 'border-muted-foreground'
                    }`}
                    aria-label={done ? 'Completed' : 'Pending'}
                  >
                    {done && (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={3}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="w-3 h-3"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </span>
                  <span className={done ? 'line-through text-muted-foreground' : ''}>
                    {step.title}
                  </span>
                </li>
              );
            })}
        </ul>
      </CardContent>
    </Card>
  );
}
