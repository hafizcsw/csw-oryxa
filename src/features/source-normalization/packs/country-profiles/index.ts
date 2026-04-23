import type { CountryEducationProfile, SourceCountryCode } from '../../types';
import { EG_PROFILE } from './EG';
import { AE_PROFILE } from './AE';
import { JO_PROFILE } from './JO';

export const COUNTRY_PROFILES: Record<SourceCountryCode, CountryEducationProfile> = {
  EG: EG_PROFILE,
  AE: AE_PROFILE,
  JO: JO_PROFILE,
};
