/**
 * Traffic Classifier
 * Determines environment, traffic_class, and admin/staff/test flags
 * for every tracked event, enabling real vs dev traffic separation.
 */

const PREVIEW_HOSTNAMES = [
  'id-preview-',           // Lovable preview pattern (id-preview-HASH--)
  'localhost',
  '127.0.0.1',
  'lovableproject.com',    // Lovable preview pattern
];

// Published domains that should be treated as production
const KNOWN_PROD_HOSTNAMES = [
  'cswworld.com',
  'lavista-launchpad.lovable.app',
];

const KNOWN_TEST_VISITORS = new Set([
  'synth-test-001',
  'v5-blend-test',
  'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeee01',
  'test',
]);

export interface TrafficMeta {
  hostname: string;
  environment: 'local' | 'preview' | 'prod';
  traffic_class: 'real' | 'internal' | 'dev' | 'seed' | 'synthetic' | 'bot';
  is_admin: boolean;
  is_staff: boolean;
  is_test: boolean;
  trace_tag: string | null;
}

export function classifyTraffic(visitorId?: string): TrafficMeta {
  const hostname = window.location.hostname;

  // Environment — check known prod first, then preview patterns
  let environment: TrafficMeta['environment'] = 'prod';
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    environment = 'local';
  } else if (KNOWN_PROD_HOSTNAMES.some(p => hostname === p || hostname.endsWith('.' + p))) {
    environment = 'prod'; // explicitly production
  } else if (PREVIEW_HOSTNAMES.some(p => hostname.includes(p))) {
    environment = 'preview';
  }

  // Traffic class
  const isKnownProd = KNOWN_PROD_HOSTNAMES.some(p => hostname === p || hostname.endsWith('.' + p));
  let traffic_class: TrafficMeta['traffic_class'] = isKnownProd ? 'real' : 'real';
  const is_test = KNOWN_TEST_VISITORS.has(visitorId || '');
  
  if (is_test) {
    traffic_class = 'synthetic';
  } else if (environment === 'local') {
    traffic_class = 'dev';
  } else if (environment === 'preview') {
    traffic_class = 'dev';
  }

  // Admin/staff detection
  const is_admin = window.location.pathname.startsWith('/admin') || 
    localStorage.getItem('is_admin') === 'true';
  const is_staff = is_admin; // For now, staff = admin

  if (is_admin && traffic_class === 'real') {
    traffic_class = 'internal';
  }

  // Trace tag from URL or storage
  const trace_tag = new URLSearchParams(window.location.search).get('trace') || 
    sessionStorage.getItem('trace_tag') || null;

  return {
    hostname,
    environment,
    traffic_class,
    is_admin,
    is_staff,
    is_test,
    trace_tag,
  };
}
