import type { CountryCode, TargetCountryProfile } from '../types';
import { CN_PACK } from './CN';
import { RU_PACK } from './RU';
import { US_PACK } from './US';
import { CA_PACK } from './CA';
import { DE_PACK } from './DE';
import { GB_PACK } from './GB';
import { ES_PACK } from './ES';
import { FI_PACK } from './FI';
import { IT_PACK } from './IT';
import { CH_PACK } from './CH';

export const COUNTRY_PACKS: Record<CountryCode, TargetCountryProfile> = {
  CN: CN_PACK,
  RU: RU_PACK,
  US: US_PACK,
  CA: CA_PACK,
  DE: DE_PACK,
  GB: GB_PACK,
  ES: ES_PACK,
  FI: FI_PACK,
  IT: IT_PACK,
  CH: CH_PACK,
};

export function getPack(code: CountryCode): TargetCountryProfile {
  return COUNTRY_PACKS[code];
}
