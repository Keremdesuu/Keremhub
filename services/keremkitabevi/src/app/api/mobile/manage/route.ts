// Deploy to keremkitabevi/src/app/api/mobile/manage/route.ts.
// Existing web actions remain the single source of mutation rules.
import { db } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { markBookUnread } from '@/lib/mobile-reading';
import { getBook } from '@/lib/queries';
import { getBookTracking, getTrackingOverview, type Status } from '@/lib/tracking';
import { getKoboToken, koboPublicOrigin } from '@/lib/kobo';
import { BASE_PATH, LIBRARY_DIR } from '@/lib/config';
import { requireLibraryMount } from '@/lib/scan-safety';
import { updateBookMetadata } from '@/app/kitap/actions';
import { createShelf, deleteShelf, setRating, setStatus, toggleShelf } from '@/app/takip/actions';
import { setBookKoboSync } from '@/app/kobo/actions';
import { POST as uploadBook } from '@/app/api/upload/route';
import { isRedirectError } from 'next/dist/client/components/redirect-error';
import { getURLFromRedirectError } from 'next/dist/client/components/redirect';
import fs from 'node:fs/promises';
import { constants } from 'node:fs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const json = (data: unknown, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
const positive = (v: unknown) => /^\d+$/.test(String(v)) && Number.isSafeInteger(Number(v)) && Number(v) > 0;
const statuses = ['want', 'reading', 'read', 'dropped'];

async function uploadState() {
  try {
    requireLibraryMount(LIBRARY_DIR);
    await fs.access(LIBRARY_DIR, constants.W_OK);
    return { writable: true, reason: null };
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code;
    return { writable: false, reason: code === 'EROFS'
      ? 'HDD salt okunur bağlı. Kitap yüklenemez; disk yazılabilir duruma gelmeden dosya kaydedilmez.'
      : code === 'EACCES' ? 'HDD dizinine yazma izni yok. Kitap yüklenemez.' : 'HDD bağlı değil veya kitap dizinine erişilemiyor. Kitap yüklenemez.' };
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url), view = url.searchParams.get('view');
  try {
    if (view === 'upload') return json(await uploadState());
    if (view === 'book') {
      const id = url.searchParams.get('id');
      if (!positive(id)) return json({ error: 'Geçersiz kitap kimliği.' }, 400);
      const book = await getBook(Number(id));
      if (!book) return json({ error: 'Kitap bulunamadı.' }, 404);
      return json({ book, tracking: await getBookTracking(Number(id)) });
    }
    if (view === 'tracking' || view === 'kobo') {
      const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
      if (!Number.isSafeInteger(page)) return json({ error: 'Geçersiz sayfa.' }, 400);
      const status = url.searchParams.get('status'), shelf = url.searchParams.get('shelfId');
      if (status && !statuses.includes(status) || shelf && !positive(shelf) || status && shelf) return json({ error: 'Tek bir geçerli durum veya raf seçin.' }, 400);
      const where = view === 'kobo' ? { koboSync: true } : shelf ? { shelves: { some: { id: Number(shelf) } } } : { entry: status ? { status } : { isNot: null } };
      const [books, total] = await Promise.all([
        db.book.findMany({ where, skip: (page - 1) * 25, take: 25, orderBy: { title: 'asc' }, include: { author: true, series: true, progress: true, entry: true, koboState: { select: { downloadedAt: true } } } }),
        db.book.count({ where }),
      ]);
      const pagination = { books, total, page, pages: Math.max(1, Math.ceil(total / 25)) };
      if (view === 'kobo') return json({ ...pagination, endpoint: `${koboPublicOrigin(request)}${BASE_PATH}/kobo/${await getKoboToken()}` });
      return json({ ...pagination, overview: await getTrackingOverview() });
    }
    return json({ error: 'Geçersiz görünüm.' }, 400);
  } catch { return json({ error: 'Kitabevi yönetim verisi alınamadı.' }, 500); }
}

// Keep the existing nginx LAN/host restrictions. No CORS or new auth bypass.
// Native requests have no Origin; the custom header blocks browser simple-form CSRF.
export async function POST(request: Request) {
  if (request.headers.get('x-keremhub-mobile') !== '1' || request.headers.get('sec-fetch-site') === 'cross-site') return json({ error: 'İstek kaynağına izin verilmiyor.' }, 403);
  const origin = request.headers.get('origin');
  if (origin && origin !== koboPublicOrigin(request)) return json({ error: 'İstek kaynağına izin verilmiyor.' }, 403);
  let expectedRedirect: string | null = null;
  try {
    const form = await request.formData(), action = form.get('action');
    if (action === 'upload') {
      const state = await uploadState();
      if (!state.writable) return json({ error: state.reason }, 507);
      const file = form.get('file');
      if (!(file instanceof File) || file.size <= 0 || file.size > 50 * 1024 * 1024) return json({ error: 'EPUB, KEPUB veya PDF dosyası seçin (en fazla 50 MB).' }, 400);
      const headers = new Headers(request.headers);
      headers.set('content-type', 'application/octet-stream');
      headers.set('content-length', String(file.size));
      headers.set('x-file-name', encodeURIComponent(file.name));
      // Delegate to the existing streaming upload and its no-overwrite scanner rules.
      return uploadBook(new Request(new URL(`${BASE_PATH}/api/upload`, koboPublicOrigin(request)), { method: 'POST', headers, body: file.stream(), duplex: 'half' } as RequestInit));
    }
    if (action === 'createShelf') {
      const result = await createShelf(String(form.get('name') ?? ''));
      return 'error' in result ? json(result, 400) : json({ ok: true, ...result });
    }
    if (action === 'deleteShelf') {
      if (!positive(form.get('shelfId'))) return json({ error: 'Geçersiz raf.' }, 400);
      await deleteShelf(Number(form.get('shelfId')));
      return json({ ok: true });
    }
    if (!positive(form.get('id'))) return json({ error: 'Geçersiz kitap kimliği.' }, 400);
    const id = Number(form.get('id'));
    if (!await db.book.findUnique({ where: { id }, select: { id: true } })) return json({ error: 'Kitap bulunamadı.' }, 404);
    if (action === 'metadata') {
      // This action validates numbers/cover, restores cover on failure, and sets
      // metadataLocked AND coverLocked exactly as the web editor does.
      expectedRedirect = `/kitap/${id}`;
      const result = await updateBookMetadata({}, form);
      return json({ error: result.error ?? 'Bilgiler kaydedilemedi.' }, 400);
    }
    if (action === 'unread') {
      await markBookUnread(id);
      for (const path of ['/', '/takip', '/kutuphane', '/kobo', `/kitap/${id}`]) revalidatePath(path);
    } else if (action === 'status') {
      const status = form.get('status');
      if (status !== '' && !statuses.includes(String(status))) return json({ error: 'Geçersiz durum.' }, 400);
      await setStatus(id, status === '' ? null : status as Status);
    } else if (action === 'rating') {
      const rating = Number(form.get('rating'));
      if (!Number.isInteger(rating) || rating < 0 || rating > 5) return json({ error: 'Puan 0–5 arasında olmalı.' }, 400);
      await setRating(id, rating);
    } else if (action === 'shelf') {
      if (!positive(form.get('shelfId')) || !['true', 'false'].includes(String(form.get('on')))) return json({ error: 'Geçersiz raf seçimi.' }, 400);
      await toggleShelf(id, Number(form.get('shelfId')), form.get('on') === 'true');
    } else if (action === 'kobo') {
      if (!['true', 'false'].includes(String(form.get('on')))) return json({ error: 'Geçersiz Kobo seçimi.' }, 400);
      expectedRedirect = form.get('returnTo') === 'kobo' ? '/kobo' : `/kitap/${id}`;
      await setBookKoboSync(form);
    } else return json({ error: 'Geçersiz işlem.' }, 400);
    return json({ ok: true });
  } catch (e) {
    // Successful web actions redirect; do not leak redirects into native fetch.
    if (isRedirectError(e)) {
      if (expectedRedirect !== null && getURLFromRedirectError(e) === expectedRedirect) return json({ ok: true });
      return json({ error: 'Beklenmeyen yönlendirme nedeniyle işlem sonucu doğrulanamadı.' }, 502);
    }
    console.error('Mobile management action failed', e);
    return json({ error: 'İşlem kaydedilemedi. Bağlantıyı kontrol edip yeniden deneyin.' }, 500);
  }
}
