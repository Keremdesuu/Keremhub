import {MediaArtwork} from "./MediaArtwork";
/** Keep the complete picture; extend its colours behind the letterboxed edges. */
export function HeroArtwork({src,posterSrc}:{src:string;posterSrc?:string}){
 return <div className={`hero-artwork ${posterSrc?"hero-artwork--poster":""}`} aria-hidden="true">
  <MediaArtwork src={src} loading="eager" className="hero-artwork__ambient"/>
  <div className="hero-artwork__picture"><MediaArtwork src={posterSrc??src} loading="eager" className="hero-artwork__image"/></div>
  <div className="hero-artwork__shade"/>
 </div>;
}
