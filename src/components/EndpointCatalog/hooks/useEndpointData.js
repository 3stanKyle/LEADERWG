import { usePerUserCatalog } from '../../../hooks/usePerUserCatalog.js';

const WG_TIERS = ['1-50', '51-100', '101-250', '251-500', '501-1000', '1001-5000', '5001+'];

export const PRODUCTS = [
  // --- Core (2026 WatchGuard Endpoint Security rebrand) ---
  // Order = capability/price: Basic < Prime < 360 < Elite. NOTE: "Prime" is NOT the
  // top tier despite the name — Elite is the flagship. Mapping (per WatchGuard):
  // EPP→Basic, EPDR→360, Advanced EPDR→Elite; Prime is a new full-EDR tier.
  {
    key: 'Endpoint Security Basic',
    label: 'Endpoint Security Basic',
    group: 'watchguard',
    section: 'core',
    badge: 'Good',
    description: 'AI-driven next-gen antivirus with automated EDR — stops known and unknown malware, ransomware, and phishing with minimal management. (Formerly WatchGuard EPP.)',
    tiers: WG_TIERS,
  },
  {
    key: 'Endpoint Security Prime',
    label: 'Endpoint Security Prime',
    group: 'watchguard',
    section: 'core',
    badge: 'Better',
    description: 'Full-featured EDR — adds anti-exploit, endpoint isolation & response, MITRE ATT&CK incident correlation, and threat hunting. (New tier, between Basic and 360.)',
    tiers: WG_TIERS,
  },
  {
    key: 'Endpoint Security 360',
    label: 'Endpoint Security 360',
    group: 'watchguard',
    section: 'core',
    badge: 'Best',
    description: 'Zero-Trust EDR — adds the deny-by-default Zero-Trust Application Service (100% process classification) and lateral-movement containment. (Formerly WatchGuard EPDR.)',
    tiers: WG_TIERS,
  },
  {
    key: 'Endpoint Security Elite',
    label: 'Endpoint Security Elite',
    group: 'watchguard',
    section: 'core',
    badge: 'Premium',
    description: 'SecOps-grade EDR — adds IOC/STIX/YARA threat hunting, advanced security policies, GenAI-assisted investigation, and remote forensics. (Formerly WatchGuard Advanced EPDR.)',
    tiers: WG_TIERS,
  },
  // --- Modules ---
  {
    key: 'Full Encryption',
    label: 'Full Encryption',
    group: 'watchguard',
    section: 'modules',
    description: 'Centrally manage BitLocker (Windows) and FileVault (macOS) encryption with recovery key escrow.',
    tiers: WG_TIERS,
  },
  {
    key: 'Patch Management',
    label: 'Patch Management',
    group: 'watchguard',
    section: 'modules',
    description: 'Discover, prioritise, and deploy OS and third-party application patches from a single console.',
    tiers: WG_TIERS,
  },
  {
    key: 'Advanced Reporting Tool',
    label: 'Advanced Reporting Tool',
    group: 'watchguard',
    section: 'modules',
    description: 'SIEM-ready advanced telemetry, custom dashboards, and automated compliance reporting.',
    tiers: WG_TIERS,
  },
  // --- DNS ---
  {
    key: 'DNSWatchGO',
    label: 'WatchGuard DNSWatchGO',
    group: 'watchguard',
    section: 'dns',
    description: 'DNS-level content filtering and phishing protection for users on and off the corporate network.',
    tiers: WG_TIERS,
  },
  // --- Bundle ---
  {
    key: 'Passport',
    label: 'WatchGuard Passport',
    group: 'watchguard',
    section: 'bundle',
    description: 'All-in-one user security bundle: EPDR + AuthPoint MFA + DNSWatchGO in a single per-user license.',
    tiers: WG_TIERS,
  },
  // --- Legacy Panda ---
  // Only Panda EPP+ remains in the 2026 catalogue; Panda Adaptive Defense 360
  // and Panda Patch Management were discontinued. Only the 1-10 and 11-25 user
  // tiers remain in the data (the ProductCard reads tiers from this static
  // config, so they must be listed explicitly).
  {
    key: 'Panda EPP+',
    label: 'Panda Endpoint Protection Plus',
    group: 'panda',
    section: 'panda',
    description: 'Legacy endpoint protection with centralised management, antivirus, anti-malware, and personal firewall.',
    tiers: ['1-10', '11-25'],
  },
];

export function useEndpointData() {
  return usePerUserCatalog('endpoint', PRODUCTS);
}
