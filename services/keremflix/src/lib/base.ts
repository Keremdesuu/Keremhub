/**
 * Site ana sayfadan /keremflix altında açılır (nginx → bu uygulama).
 * Next.js <Link>, router ve statik dosyalar bu öneki kendisi ekler;
 * fetch(), <video src>, sendBeacon gibi elle yazılan adreslerde withBase() kullanılır.
 * Değer .env içindeki NEXT_PUBLIC_BASE_PATH ile değişir (derlemeden önce). Boş = kök.
 */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "/keremflix";

export const withBase = (p: string) => `${BASE_PATH}${p}`;
