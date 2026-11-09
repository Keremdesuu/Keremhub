import { useId } from "react";
import { Ikon } from "@/lib/icons";
import type { SiteDTO } from "@/lib/sites";

/** Original vector artwork. Each app shares a bevel and has its own material. */
export function AppIcon({ site }: { site: SiteDTO }) {
  const id = useId().replace(/:/g, "");
  const film = site.yol.includes("keremflix") || site.ikon === "film";
  const book = site.yol.includes("kitabevi") || ["kitap", "kutuphane"].includes(site.ikon);
  const gallery = site.yol.includes("xxxkerem") || ["foto", "tv", "kamera"].includes(site.ikon);
  const colors = film ? ["#ff5e70", "#db1839", "#790e28"] : book ? ["#ffc66d", "#ee8c28", "#b95722"] : gallery ? ["#cfb4ff", "#8460dc", "#43318e"] : [site.renk, site.renk, "#17223f"];
  return <span className="app-icon" aria-hidden="true">
    <svg viewBox="0 0 128 128" fill="none">
      <defs>
        <linearGradient id={`${id}-base`} x1="20" y1="4" x2="108" y2="128" gradientUnits="userSpaceOnUse"><stop stopColor={colors[0]}/><stop offset=".52" stopColor={colors[1]}/><stop offset="1" stopColor={colors[2]}/></linearGradient>
        <linearGradient id={`${id}-shine`} x1="64" y1="5" x2="64" y2="123" gradientUnits="userSpaceOnUse"><stop stopColor="white" stopOpacity=".65"/><stop offset=".48" stopColor="white" stopOpacity="0"/><stop offset="1" stopColor="black" stopOpacity=".2"/></linearGradient>
        <linearGradient id={`${id}-paper`} x1="35" y1="33" x2="96" y2="100" gradientUnits="userSpaceOnUse"><stop stopColor="#fffef8"/><stop offset="1" stopColor="#e6d5b6"/></linearGradient>
        <linearGradient id={`${id}-screen`} x1="40" y1="35" x2="90" y2="99" gradientUnits="userSpaceOnUse"><stop stopColor="#3e334d"/><stop offset="1" stopColor="#171322"/></linearGradient>
        <filter id={`${id}-shadow`} x="-40%" y="-40%" width="180%" height="200%"><feDropShadow dx="0" dy="5" stdDeviation="3" floodColor="#241025" floodOpacity=".35"/></filter>
      </defs>
      <rect x="4" y="4" width="120" height="120" rx="28" fill={`url(#${id}-base)`}/>
      <rect x="5" y="5" width="118" height="118" rx="27" stroke={`url(#${id}-shine)`} strokeWidth="2"/>
      <path d="M31 8h66c14 0 23 9 23 23v20C89 26 46 37 8 66V31C8 17 17 8 31 8Z" fill="white" opacity=".08"/>
      {film ? <g filter={`url(#${id}-shadow)`}>
        <rect x="23" y="31" width="82" height="67" rx="15" fill={`url(#${id}-screen)`} stroke="#ffb2c0" strokeOpacity=".75" strokeWidth="2"/>
        <path d="m56 49 23 14c2 1 2 4 0 5L56 82c-2 1-4 0-4-2V51c0-2 2-3 4-2Z" fill="#fff4ed"/>
        {[40,54,68,82].map(y=><g key={y}><rect x="28" y={y} width="5" height="7" rx="1.5" fill="#f9879d"/><rect x="95" y={y} width="5" height="7" rx="1.5" fill="#f9879d"/></g>)}
      </g> : book ? <g filter={`url(#${id}-shadow)`}>
        <path d="M24 33c15-6 27-4 40 4 13-8 25-10 40-4v62c-15-5-27-4-40 3-13-7-25-8-40-3V33Z" fill="#9d461a"/>
        <path d="M25 28c16-5 27-2 39 6v58c-12-8-23-10-39-5V28Z" fill={`url(#${id}-paper)`}/>
        <path d="M103 28c-16-5-27-2-39 6v58c12-8 23-10 39-5V28Z" fill="#fff9e9"/>
        <path d="M64 35v56" stroke="#d3b78d" strokeWidth="2"/>
        <path d="M34 44c7-1 12 0 20 4m-20 8c7-1 12 0 20 4m-20 8c7-1 12 0 20 4m20-24c7-4 13-5 20-4m-20 16c7-4 13-5 20-4m-20 16c7-4 13-5 20-4" stroke="#bb9c71" strokeWidth="2.5" strokeLinecap="round"/>
        <path d="M82 29v27l6-4 6 2V28" fill="#e65f46"/>
      </g> : gallery ? <g filter={`url(#${id}-shadow)`}>
        <rect x="26" y="25" width="70" height="74" rx="10" transform="rotate(-12 26 25)" fill="#dfd0ff"/>
        <rect x="31" y="29" width="72" height="74" rx="10" transform="rotate(7 31 29)" fill="#fff9ef"/>
        <path d="m39 39 55 7-5 45-55-7 5-45Z" fill="#e7ab65"/>
        <circle cx="78" cy="56" r="8" fill="#fff2b8"/>
        <path d="m34 84 23-28 13 20 9-8 11 23-56-7Z" fill="#7361ab"/>
        <path d="m34 84 21-15 15 19-36-4Z" fill="#49416f"/>
      </g> : null}
    </svg>
    {!film && !book && !gallery && <span className="generic-glyph"><Ikon ad={site.ikon} size={58}/></span>}
  </span>;
}
