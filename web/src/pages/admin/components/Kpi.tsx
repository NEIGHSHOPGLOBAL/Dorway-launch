interface Tile {
  value: number;
  previousValue?: number;
  pctChange?: number | null;
}

export function KpiRow({ tiles }: { tiles: { label: string; tile: Tile; format?: (n: number) => string; suffix?: string }[] }) {
  return (
    <div className="admin-kpi-row">
      {tiles.map((t) => (
        <div className="admin-kpi" key={t.label}>
          <div className="label">{t.label}</div>
          <div className="value">{t.format ? t.format(t.tile.value) : `${t.tile.value.toLocaleString("en-IN")}${t.suffix ?? ""}`}</div>
          {t.tile.pctChange !== null && t.tile.pctChange !== undefined && (
            <div className={`change ${t.tile.pctChange >= 0 ? "up" : "down"}`}>
              {t.tile.pctChange >= 0 ? "▲" : "▼"} {Math.abs(t.tile.pctChange).toFixed(1)}% vs previous
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
