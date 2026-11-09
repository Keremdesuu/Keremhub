import type { Preferences } from "./types.ts";
import { defaults } from "./api.ts";

export function SubtitleSettings({
  prefs,
  update,
}: {
  prefs: Preferences;
  update: (value: Partial<Preferences>) => void;
}) {
  return (
    <div className="subtitle-settings">
      <h3>Altyazı görünümü</h3>
      <div
        className={
          "subtitle-sample " + (prefs.subBackground ? "with-background" : "")
        }
        style={{ fontSize: prefs.subSize }}
        aria-label="Altyazı önizlemesi"
      >
        <span>Her hikâye, yeni bir dünya.</span>
      </div>
      <h3>Yazı boyutu · {prefs.subSize} px</h3>
      <div className="button-row">
        <button
          className="soft-btn"
          disabled={prefs.subSize <= 22}
          onClick={() => update({ subSize: Math.max(22, prefs.subSize - 4) })}
        >
          Yazıyı küçült
        </button>
        <button
          className="soft-btn"
          disabled={prefs.subSize >= 64}
          onClick={() => update({ subSize: Math.min(64, prefs.subSize + 4) })}
        >
          Yazıyı büyüt
        </button>
      </div>
      <div className="button-row subtitle-size-presets">
        {[30, 38, 46, 54].map((size) => (
          <button
            key={size}
            className={"chip " + (prefs.subSize === size ? "active" : "")}
            aria-pressed={prefs.subSize === size}
            onClick={() => update({ subSize: size })}
          >
            {size === 30
              ? "Küçük"
              : size === 38
                ? "Normal"
                : size === 46
                  ? "Büyük"
                  : "Çok büyük"}
          </button>
        ))}
      </div>
      <button
        className="menu-option"
        aria-pressed={prefs.subBackground}
        onClick={() => update({ subBackground: !prefs.subBackground })}
      >
        <span>Siyah arka plan</span>
        <span>{prefs.subBackground ? "Açık" : "Kapalı"}</span>
      </button>
      <h3>Dikey konum · %{prefs.subPosition}</h3>
      <div className="button-row">
        <button
          className="soft-btn"
          disabled={prefs.subPosition <= 5}
          onClick={() =>
            update({ subPosition: Math.max(5, prefs.subPosition - 5) })
          }
        >
          Yukarı taşı
        </button>
        <button
          className="soft-btn"
          disabled={prefs.subPosition >= 95}
          onClick={() =>
            update({ subPosition: Math.min(95, prefs.subPosition + 5) })
          }
        >
          Aşağı taşı
        </button>
      </div>
      <div className="button-row subtitle-position-presets">
        {[
          ["Üst boşluk", 7],
          ["Orta", 50],
          ["Alt boşluk", 93],
        ].map(([label, position]) => (
          <button
            key={label}
            className={
              "chip " + (prefs.subPosition === position ? "active" : "")
            }
            aria-pressed={prefs.subPosition === position}
            onClick={() => update({ subPosition: Number(position) })}
          >
            {label}
          </button>
        ))}
      </div>
      <p className="menu-note">
        Konum tüm ekranı kapsar. Üst ve alt siyah boşluklara taşımak için Ekrana
        sığdır görünümünü kullan.
      </p>
      <button
        className="soft-btn"
        onClick={() =>
          update({
            subSize: defaults.subSize,
            subBackground: defaults.subBackground,
            subPosition: defaults.subPosition,
            subDelay: defaults.subDelay,
          })
        }
      >
        Altyazıları varsayılana döndür
      </button>
    </div>
  );
}
