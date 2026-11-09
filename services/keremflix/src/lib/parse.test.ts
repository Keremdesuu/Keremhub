import { describe, expect, it } from "vitest";
import { cleanTitle, detectQuality, parseEpisode, parseSeasonFolder } from "./parse";

describe("cleanTitle", () => {
  it("noktalı sürüm adını temizler", () => {
    expect(cleanTitle("The.Matrix.1999.1080p.BluRay.x264")).toEqual({ title: "The Matrix", year: 1999 });
  });
  it("parantezli yılı alır", () => {
    expect(cleanTitle("Inception (2010)")).toEqual({ title: "Inception", year: 2010 });
  });
  it("grup etiketlerini atar", () => {
    expect(cleanTitle("[SubGrup] Spy x Family").title).toBe("Spy x Family");
  });
});

describe("parseEpisode", () => {
  it("S01E02", () => expect(parseEpisode("Show.S01E02.mkv", null)).toMatchObject({ season: 1, number: 2 }));
  it("1x05", () => expect(parseEpisode("Show 2x05.mp4", null)).toMatchObject({ season: 2, number: 5 }));
  it("anime tarzı", () =>
    expect(parseEpisode("[Grup] Naruto - 12 [1080p].mkv", 1)).toMatchObject({ season: 1, number: 12 }));
  it("bölüm kelimesi", () =>
    expect(parseEpisode("Dizi Bölüm 7.mp4", 3)).toMatchObject({ season: 3, number: 7 }));
});

describe("diğer", () => {
  it("sezon klasörü", () => {
    expect(parseSeasonFolder("Sezon 02")).toBe(2);
    expect(parseSeasonFolder("Season 1")).toBe(1);
    expect(parseSeasonFolder("Extras")).toBeNull();
  });
  it("kalite", () => {
    expect(detectQuality("x.2160p.HDR.mkv")).toEqual({ quality: "4K", hdr: true });
    expect(detectQuality("x.1080p.mkv").quality).toBe("HD");
  });
});
