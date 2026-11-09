// Site bir alt yolda (ör. /yol) yayınlanacaksa .env içinde NEXT_PUBLIC_BASE_PATH="/yol" yaz.
export const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
