'use client';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface Nutrient {
  name: string;
  value: string | number;
  unit?: string;
  dailyValue?: string;
}

interface NutritionTableProps {
  nutrients: Nutrient[];
}

export function NutritionTable({ nutrients }: NutritionTableProps) {
  if (!nutrients || nutrients.length === 0) return null;

  return (
    <div className="rounded-lg border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="font-semibold">Nutriment</TableHead>
            <TableHead className="font-semibold text-right">Valeur</TableHead>
            {nutrients.some(n => n.dailyValue) && (
              <TableHead className="font-semibold text-right">% VNR</TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {nutrients.map((nutrient, index) => (
            <TableRow key={index}>
              <TableCell className="font-medium">{nutrient.name}</TableCell>
              <TableCell className="text-right">
                {nutrient.value} {nutrient.unit || ''}
              </TableCell>
              {nutrients.some(n => n.dailyValue) && (
                <TableCell className="text-right text-muted-foreground">
                  {nutrient.dailyValue || '-'}
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
