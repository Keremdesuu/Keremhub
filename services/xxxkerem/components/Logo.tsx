import Link from "next/link";

export default function Logo() {
  const a = process.env.NEXT_PUBLIC_SITE_NAME_A ?? "Site";
  const b = process.env.NEXT_PUBLIC_SITE_NAME_B ?? "Adı";
  return (
    <Link href="/" className="flex shrink-0 items-center text-2xl font-extrabold tracking-tight">
      <span className="text-white">{a}</span>
      <span className="ml-1 rounded-md bg-brand px-1.5 text-ink">{b}</span>
    </Link>
  );
}
