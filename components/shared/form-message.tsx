type FormMessageProps = { error?: string | null; success?: string | null };

export function FormMessage({ error, success }: FormMessageProps) {
  if (!error && !success) return null;

  return (
    <div className={`rounded-xl border px-3 py-2 text-sm ${error ? 'border-red-900 bg-red-950 text-red-200' : 'border-emerald-900 bg-emerald-950 text-emerald-200'}`}>
      {error ?? success}
    </div>
  );
}
