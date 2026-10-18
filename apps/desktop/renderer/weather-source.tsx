import React from 'react';

export type NormalizedWeatherSource = { name: string; url?: string; license?: string; licenseUrl?: string; text?: string };
const shortText = (value: unknown, limit = 300) => typeof value === 'string' && value.trim() ? value.trim().slice(0, limit) : undefined;
function officialLink(value: unknown, hostname: string) {
  if (typeof value !== 'string' || value.length > 2048) return undefined;
  try { const url = new URL(value); return url.protocol === 'https:' && url.hostname === hostname && !url.username && !url.password && !url.port ? url.href : undefined; }
  catch { return undefined; }
}

/** Accept the actual backend contract and older string payloads; never render raw objects. */
export function normalizeWeatherSource(source: unknown): NormalizedWeatherSource | null {
  if (typeof source === 'string') { const name = shortText(source); return name ? { name } : null; }
  if (!source || typeof source !== 'object' || Array.isArray(source)) return null;
  const value = source as Record<string, unknown>;
  const name = shortText(value.name, 120);
  if (!name) return null;
  return { name, url: officialLink(value.url, 'open-meteo.com'), license: shortText(value.license, 80), licenseUrl: officialLink(value.licenseUrl, 'creativecommons.org'), text: shortText(value.text) };
}

export function WeatherSource({ source, onOpen, compact = false }: { source: unknown; onOpen?: (url: string) => void; compact?: boolean }) {
  const value = normalizeWeatherSource(source);
  if (!value) return null;
  const link = (label: string, url?: string) => url ? <a href={url} target="_blank" rel="noopener noreferrer" onClick={event => { if (onOpen) { event.preventDefault(); onOpen(url); } }}>{label}</a> : <span>{label}</span>;
  return <small className={`message-source${compact ? ' compact' : ''}`} title={compact ? value.text : undefined}>{compact ? 'Tempo: ' : 'Fonte do tempo: '}{link(value.name, value.url)}{value.license && <> · {link(value.license, value.licenseUrl)}</>}{!compact && value.text && <span className="source-description">{value.text}</span>}</small>;
}
