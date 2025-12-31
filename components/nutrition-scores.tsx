'use client';

import { Badge } from '@/components/ui/badge';

interface NutritionScoresProps {
  nutriScore?: string;
  novaGroup?: number;
  greenScore?: number;
}

export function NutritionScores({ nutriScore, novaGroup, greenScore }: NutritionScoresProps) {
  if (!nutriScore && !novaGroup && !greenScore) return null;

  const getNutriScoreColor = (score: string) => {
    const colors: Record<string, string> = {
      'a': 'bg-green-500',
      'b': 'bg-lime-500',
      'c': 'bg-yellow-500',
      'd': 'bg-orange-500',
      'e': 'bg-red-500',
    };
    return colors[score.toLowerCase()] || 'bg-gray-500';
  };

  const getNovaGroupColor = (group: number) => {
    const colors: Record<number, string> = {
      1: 'bg-green-500',
      2: 'bg-lime-500',
      3: 'bg-yellow-500',
      4: 'bg-red-500',
    };
    return colors[group] || 'bg-gray-500';
  };

  return (
    <div className="flex flex-wrap gap-3 p-4 bg-muted/50 rounded-lg border">
      {nutriScore && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Nutri-Score:</span>
          <Badge className={`${getNutriScoreColor(nutriScore)} text-white font-bold`}>
            {nutriScore.toUpperCase()}
          </Badge>
        </div>
      )}
      {novaGroup && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">NOVA:</span>
          <Badge className={`${getNovaGroupColor(novaGroup)} text-white font-bold`}>
            {novaGroup}
          </Badge>
        </div>
      )}
      {greenScore !== undefined && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Eco-Score:</span>
          <Badge variant="outline">{greenScore}</Badge>
        </div>
      )}
    </div>
  );
}
