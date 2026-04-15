import { Card } from '@/components/ui/card';

type KpiCardProps = {
  title: string;
  value: string;
  hint?: string;
};

export function KpiCard({ title, value, hint }: KpiCardProps) {
  return (
    <Card className="rounded-[24px]">
      <div className="text-xs uppercase tracking-wide text-zinc-500">{title}</div>
      <div className="mt-2 text-3xl font-semibold tracking-tight text-white">{value}</div>
      {hint ? <div className="mt-2 text-xs text-zinc-500">{hint}</div> : null}
    </Card>
  );
}
