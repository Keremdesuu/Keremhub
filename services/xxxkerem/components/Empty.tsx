import { FolderSearch } from "lucide-react";

export default function Empty({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg bg-panel px-6 py-20 text-center">
      <FolderSearch size={44} className="text-brand" />
      <h2 className="mt-4 text-lg font-bold">{title}</h2>
      {hint && <p className="mt-1 max-w-md text-sm text-muted">{hint}</p>}
    </div>
  );
}
