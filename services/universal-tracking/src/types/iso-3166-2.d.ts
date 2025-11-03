declare module 'iso-3166-2' {
  export interface ISO3166Subdivision {
    code: string;
    name: string;
    type: string;
    countryCode?: string;
    countryName?: string;
    regionCode?: string;
    parent?: string;
  }

  interface ISO3166Module {
    country(code: string): { name: string; sub?: Record<string, ISO3166Subdivision>; code: string } | undefined;
    subdivision(code: string): ISO3166Subdivision | undefined;
  }

  const iso3166: ISO3166Module;
  export default iso3166;
}

