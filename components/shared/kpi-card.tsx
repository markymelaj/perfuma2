import { Card } from '@/components/ui/card';

type KpiCardProps = {
  title: string;
  value: string;
  hint?: string;
};

export function KpiCard({ title, value, hint }: KpiCardProps) {
  return (
    <Card className="p-4 sm:p-5">
      <div className="text-xs uppercase tracking-wide text-zinc-500">{title}</div>
      <div className="mt-2 text-2xl font-semibold text-white sm:text-3xl">{value}</div>
      {hint ? <div className="mt-2 text-xs text-zinc-500">{hint}</div> : null}
    </Card>
  );
}
