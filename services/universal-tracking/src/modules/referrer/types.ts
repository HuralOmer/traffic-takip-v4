export type ReferrerSourceCategory =
  | 'direct'
  | 'search'
  | 'social'
  | 'referral'
  | 'email'
  | 'ad'
  | 'unknown';

export type ReferrerNavigationType = 'navigate' | 'reload' | 'back_forward' | 'prerender' | 'restore' | 'unknown';

export interface ReferrerInfo {
  referrerUrl: string | null;
  referrerDomain: string | null;
  landingPage: string | null;
  source: string;
  sourceCategory: ReferrerSourceCategory;
  medium: string | null;
  campaign: string | null;
  term: string | null;
  content: string | null;
  gclid: string | null;
  fbclid: string | null;
  msclkid: string | null;
  gadSource?: string | null;
  gadCampaignId?: string | null;
  gbraid?: string | null;
  wbraid?: string | null;
  ttclid?: string | null;
  epik?: string | null;
  liFatId?: string | null;
  liAdId?: string | null;
  rdtCid?: string | null;
  rdtAid?: string | null;
  scCid?: string | null;
  scAid?: string | null;
  utmPresent: boolean;
  isAd: boolean;
  isSocial: boolean;
  isDirect: boolean;
  navigationType: ReferrerNavigationType;
}

export interface ReferrerExtractOptions {
  referrer?: string | null;
  currentUrl?: string | null;
  search?: string | null | URLSearchParams;
  navigationType?: ReferrerNavigationType | string | null;
  userAgent?: string | null;
}

