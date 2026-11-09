export type Status = "want" | "reading" | "read" | "dropped";

/** Ana raflar: db değeri, adres parametresi ve ekranda görünen ad */
export const STATUSES: {
  key: Status;
  slug: string;
  label: string;
  hint: string;
}[] = [
  { key: "reading", slug: "okunuyor", label: "Okunuyor", hint: "Şu an okuduklarım" },
  { key: "want", slug: "okumak-istiyorum", label: "Okumak istiyorum", hint: "Sıradakiler" },
  { key: "read", slug: "okundu", label: "Okundu", hint: "Bitirdiklerim" },
  { key: "dropped", slug: "yarida-biraktim", label: "Yarıda bıraktım", hint: "Bırakıp belki sonra döneceklerim" },
];

export const statusLabel = (s: string) =>
  STATUSES.find((x) => x.key === s)?.label ?? s;
