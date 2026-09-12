import { Cloud, Droplets, Sun, Thermometer, Wind } from 'lucide-react';
import type { WeatherDay } from '@/types';
import { Panel } from '@/components/common/Panel';
import { fmtNumber } from '@/lib/format';

export function WeatherCard({ weather, date, title = 'Weather conditions' }: { weather: WeatherDay | null | undefined; date?: string | null; title?: string }) {
  const rows = [
    { icon: Sun, label: 'Solar irradiance', value: weather?.solar_irradiance_kwh_m2, unit: 'kWh/m²' },
    { icon: Thermometer, label: 'Temperature', value: weather?.temperature_c, unit: '°C' },
    { icon: Cloud, label: 'Cloud cover', value: weather?.cloud_cover_pct, unit: '%' },
    { icon: Droplets, label: 'Humidity', value: weather?.humidity_pct, unit: '%' },
    { icon: Wind, label: 'Wind speed', value: weather?.wind_speed_ms, unit: 'm/s' },
  ];
  return (
    <Panel title={title} subtitle={date ? `Observed ${date}` : undefined}>
      {!weather ? <p className="text-sm text-ink-3">No weather observation available.</p> : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {rows.map((r) => (
            <li key={r.label} className="rounded-lg bg-surface-2 p-3">
              <r.icon size={16} className="text-primary" />
              <div className="num mt-2 text-lg font-semibold leading-none">{fmtNumber(r.value ?? null, 1)}<span className="ml-1 text-xs font-normal text-ink-3">{r.unit}</span></div>
              <div className="mt-1 text-[11px] text-ink-3">{r.label}</div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
