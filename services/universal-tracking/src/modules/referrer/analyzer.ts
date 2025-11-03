import { SOCIAL_DOMAINS, SEARCH_DOMAINS, AD_MEDIUM_HINTS } from './constants.js';
import type {
  ReferrerExtractOptions,
  ReferrerInfo,
  ReferrerNavigationType,
  ReferrerSourceCategory,
} from './types.js';

function toNavigationType(input?: ReferrerNavigationType | string | null): ReferrerNavigationType {
  if (!input) return 'unknown';
  const value = input.toString().toLowerCase();
  switch (value) {
    case 'navigate':
    case 'navigation':
      return 'navigate';
    case 'reload':
      return 'reload';
    case 'back_forward':
    case 'back-forward':
    case 'backforward':
      return 'back_forward';
    case 'prerender':
      return 'prerender';
    case 'restore':
    case 'pageshow':
      return 'restore';
    default:
      return 'unknown';
  }
}

function toNullOrString(value?: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function extractDomain(url: string | null): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.hostname.toLowerCase();
  } catch {
    return null;
  }
}

function getSearchParams(options: ReferrerExtractOptions): URLSearchParams {
  if (options.search instanceof URLSearchParams) {
    return options.search;
  }
  if (typeof options.search === 'string') {
    return new URLSearchParams(options.search.startsWith('?') ? options.search : `?${options.search}`);
  }
  if (options.currentUrl) {
    try {
      return new URL(options.currentUrl).searchParams;
    } catch {
      return new URLSearchParams();
    }
  }
  return new URLSearchParams();
}

function getSearchMap(params: URLSearchParams): Map<string, string> {
  const map = new Map<string, string>();
  for (const [key, value] of params.entries()) {
    if (!key) continue;
    map.set(key.toLowerCase(), value);
  }
  return map;
}

function detectSourceCategory(
  referrerDomain: string | null,
  utmSource: string | null,
  medium: string | null,
  isAd: boolean,
  isSocial: boolean
): ReferrerSourceCategory {
  if (isAd) return 'ad';
  if (utmSource) {
    if (utmSource.includes('email')) return 'email';
    if (utmSource.includes('social')) return 'social';
  }
  if (isSocial) return 'social';
  if (medium && AD_MEDIUM_HINTS.includes(medium.toLowerCase())) return 'ad';
  if (!referrerDomain && !utmSource) return 'direct';
  if (referrerDomain && SEARCH_DOMAINS.some((domain) => referrerDomain.includes(domain))) {
    return 'search';
  }
  if (utmSource && utmSource.includes('email')) return 'email';
  if (referrerDomain) return 'referral';
  return 'unknown';
}

function inferSourceLabel(
  referrerDomain: string | null,
  utmSource: string | null,
  utmMedium: string | null
): string {
  if (utmSource) return utmSource.toLowerCase();
  if (!referrerDomain) return 'direct';
  if (referrerDomain.startsWith('l.')) {
    return referrerDomain.substring(2);
  }
  if (utmMedium && utmMedium.toLowerCase() === 'email') {
    return 'email';
  }
  return referrerDomain;
}

function determineSocial(referrerDomain: string | null, utmSource: string | null): boolean {
  if (utmSource && utmSource.toLowerCase().includes('social')) {
    return true;
  }
  if (!referrerDomain) return false;
  return SOCIAL_DOMAINS.some((domain) => referrerDomain.includes(domain));
}

function detectAd(
  utmMedium: string | null,
  utmSource: string | null,
  gclid: string | null,
  fbclid: string | null,
  msclkid: string | null,
  ttclid: string | null,
  epik: string | null,
  liFatId: string | null,
  liAdId: string | null,
  rdtCid: string | null,
  rdtAid: string | null,
  scCid: string | null,
  scAid: string | null
): boolean {
  if (gclid || msclkid || ttclid || epik || liFatId || liAdId || rdtCid || rdtAid || scCid || scAid) return true;
  if (utmMedium) {
    const mediumLower = utmMedium.toLowerCase();
    if (AD_MEDIUM_HINTS.some((hint) => mediumLower.includes(hint)) || mediumLower.includes('paid')) {
      return true;
    }
  }
  if (utmSource) {
    const lowered = utmSource.toLowerCase();
    if (lowered.includes('ads') || lowered.includes('adword') || lowered.includes('cpc') || lowered.includes('ppc') || lowered.includes('paid')) {
      return true;
    }
  }
  if (fbclid) {
    if (utmMedium) {
      const mediumLower = utmMedium.toLowerCase();
      if (AD_MEDIUM_HINTS.some((hint) => mediumLower.includes(hint)) || mediumLower.includes('paid')) return true;
    }
    if (utmSource) {
      const lowered = utmSource.toLowerCase();
      if (lowered.includes('ads') || lowered.includes('paid')) return true;
    }
  }
  return false;
}

export function extractReferrerInfo(options: ReferrerExtractOptions = {}): ReferrerInfo {
  const referrerUrl = toNullOrString(options.referrer);
  const referrerDomain = extractDomain(referrerUrl);
  const landingPage = toNullOrString(options.currentUrl);

  const searchParams = getSearchParams(options);
  const paramsMap = getSearchMap(searchParams);

  const utmSource = toNullOrString(paramsMap.get('utm_source') ?? null);
  const utmMedium = toNullOrString(paramsMap.get('utm_medium') ?? null);
  const utmCampaign = toNullOrString(paramsMap.get('utm_campaign') ?? null);
  const utmTerm = toNullOrString(paramsMap.get('utm_term') ?? null);
  const utmContent = toNullOrString(paramsMap.get('utm_content') ?? null);
  const gclid = toNullOrString(paramsMap.get('gclid') ?? null);
  const fbclid = toNullOrString(paramsMap.get('fbclid') ?? null);
  const msclkid = toNullOrString(paramsMap.get('msclkid') ?? null);
  const gadSource = toNullOrString(paramsMap.get('gad_source') ?? null);
  const gadCampaignId = toNullOrString(paramsMap.get('gad_campaignid') ?? null);
  const gbraid = toNullOrString(paramsMap.get('gbraid') ?? null);
  const wbraid = toNullOrString(paramsMap.get('wbraid') ?? null);
  const ttclid = toNullOrString(paramsMap.get('ttclid') ?? null);
  const epik = toNullOrString(paramsMap.get('epik') ?? null);
  const liFatId = toNullOrString(paramsMap.get('li_fat_id') ?? paramsMap.get('lifatid') ?? null);
  const liAdId = toNullOrString(paramsMap.get('li_adid') ?? paramsMap.get('liadid') ?? null);
  const rdtCid = toNullOrString(paramsMap.get('rdt_cid') ?? paramsMap.get('rdtcid') ?? null);
  const rdtAid = toNullOrString(paramsMap.get('rdt_aid') ?? paramsMap.get('rdtaid') ?? null);
  const scCid = toNullOrString(paramsMap.get('scid') ?? paramsMap.get('sc_cid') ?? paramsMap.get('sccid') ?? null);
  const scAid = toNullOrString(paramsMap.get('scaid') ?? paramsMap.get('sc_aid') ?? paramsMap.get('sccaid') ?? null);

  const isAd = detectAd(
    utmMedium,
    utmSource,
    gclid,
    fbclid,
    msclkid,
    ttclid,
    epik,
    liFatId,
    liAdId,
    rdtCid,
    rdtAid,
    scCid,
    scAid
  );
  const isSocial = determineSocial(referrerDomain, utmSource);

  const sourceCategory = detectSourceCategory(referrerDomain, utmSource, utmMedium, isAd, isSocial);
  const source = inferSourceLabel(referrerDomain, utmSource, utmMedium);

  const navigationType = toNavigationType(options.navigationType);

  const info: ReferrerInfo = {
    referrerUrl,
    referrerDomain,
    landingPage,
    source,
    sourceCategory,
    medium: utmMedium,
    campaign: utmCampaign,
    term: utmTerm,
    content: utmContent,
    gclid,
    fbclid,
    msclkid,
    gadSource,
    gadCampaignId,
    gbraid,
    wbraid,
    ttclid,
    epik,
    liFatId,
    liAdId,
    rdtCid,
    rdtAid,
    scCid,
    scAid,
    utmPresent: Boolean(utmSource || utmMedium || utmCampaign || utmTerm || utmContent),
    isAd,
    isSocial,
    isDirect: sourceCategory === 'direct',
    navigationType,
  };

  const allowedKeys: (keyof ReferrerInfo)[] = [
    'referrerDomain',
    'landingPage',
    'source',
    'sourceCategory',
    'navigationType',
  ];

  const allowedSet = new Set(allowedKeys);

  const sanitized = Object.fromEntries(
    Object.entries(info).filter(([key, value]) => allowedSet.has(key as keyof ReferrerInfo) && value !== null && value !== undefined)
  );

  return sanitized as ReferrerInfo;
}

export function mergeReferrerInfo(
  primary?: ReferrerInfo | null,
  fallback?: ReferrerInfo | null
): ReferrerInfo | undefined {
  if (primary) return primary;
  return fallback ?? undefined;
}

