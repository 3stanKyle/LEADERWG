# WatchGuard Product Knowledge

## Product Line Overview

### Security Appliances (Firebox)
- **T-Series (Tabletop)**: Compact desktop firewalls for small and mid-size businesses. Models: T25, T25-W, T45, T45-W, T85, T85-W (W = built-in Wi-Fi).
- **M-Series (Rackmount)**: High-performance 1U rackmount firewalls for mid-size to large enterprises. Models: M290, M390, M490, M590, M690.
- All Firebox appliances run Fireware OS and support the WatchGuard Unified Security Platform.

### Virtual & Cloud Firewalls
- **FireboxV**: Virtual appliances for VMware, Hyper-V, and KVM. Sizes: Small, Medium, Large, XLarge. Same Fireware OS and feature set as hardware.
- **Firebox Cloud**: Purpose-built for AWS and Azure. Same Fireware management. Sizes: Small, Medium, Large, XLarge.

### Endpoint Security
- **WatchGuard EPDR** (Endpoint Protection, Detection & Response): Full endpoint suite — antivirus, EDR, patch management, encryption, vulnerability assessment. The flagship endpoint product.
- **WatchGuard EDR** (Endpoint Detection & Response): EDR-only, pairs with existing third-party antivirus.
- **WatchGuard EPP** (Endpoint Protection Platform): Antivirus and protection without EDR. Entry-level.
- **WatchGuard ADR** (Advanced Detection & Response): Advanced threat hunting and response for SOC teams.

### Identity & Access
- **AuthPoint MFA**: Cloud-based multi-factor authentication. Mobile push, QR code, OTP. No hardware tokens required.
- **AuthPoint Total Identity Security**: MFA + single sign-on (SSO) + dark web credential monitoring + corporate password management.

### Email Security
- **WatchGuard Email Security**: Cloud-based email protection — anti-spam, anti-phishing, DLP, email encryption, archiving.

### Managed Detection & Response
- **WatchGuard MDR**: 24/7 threat monitoring and response service by WatchGuard's SOC team. For partners who want to offer MDR without building a SOC.
- **ThreatSync+ NDR**: Network Detection and Response — AI-powered network traffic analysis for threat detection.

## Sizing Guidelines

### Firebox Appliances by User Count
| Model | Recommended Users | Throughput (Firewall) | Use Case |
|-------|------------------|-----------------------|----------|
| T25 / T25-W | 1–15 | 3.92 Gbps | Home office, micro-business |
| T45 / T45-W | 15–30 | 3.92 Gbps | Small office, retail |
| T85 / T85-W | 30–60 | 3.92 Gbps | Mid-size office, branch |
| M290 | 50–150 | 5.8 Gbps | Mid-size business HQ |
| M390 | 150–300 | 18 Gbps | Large office, campus |
| M490 | 300–500 | 28 Gbps | Enterprise, data center edge |
| M590 | 500–1,000 | 40 Gbps | Large enterprise |
| M690 | 1,000–2,500 | 55 Gbps | Large enterprise, service provider |

These are rough guidelines. Actual sizing depends on enabled security services, traffic patterns, and VPN usage. When UTM services are fully enabled, throughput is lower than raw firewall throughput.

### Per-User Products
Endpoint, Identity, Email, MDR, and NDR products are licensed per user with tier-based pricing:
- 1–50 users, 51–100, 101–250, 251–500, 501–1000, 1001–5000
- Lower per-user cost at higher tiers
- Available in 1-year and 3-year terms

## Subscription Tiers (Security Appliances)

### Basic Security Suite (BSS)
Includes: Intrusion Prevention (IPS), Gateway AntiVirus, URL Filtering (WebBlocker), Application Control, Reputation Enabled Defense, Network Discovery, SpamBlocker. Standard support included.

### Total Security Suite (TSS)
Everything in BSS plus: APT Blocker (sandboxing), DNSWatch (DNS-level protection), IntelligentAV (AI-powered malware detection), ThreatSync (XDR correlation), EDR Core, WatchGuard Cloud visibility. Gold support included.

**Recommendation**: Total Security Suite is the best value for most customers. It adds critical advanced threat protection that Basic lacks.

## Term Length Guidance

- **1-Year**: Highest per-year cost. Good for trials or uncertain deployments.
- **3-Year**: Best price-per-year for most customers. Recommended default. Typically 15–20% savings vs buying 1-year three times.
- **5-Year**: Available for some products. Lowest per-year cost but requires longer commitment.

**Default recommendation**: 3-year term for the best balance of savings and flexibility.

## Renewal vs Trade-Up

- **Renewal**: Extends subscriptions on the same hardware. Choose this when the current appliance still meets performance needs.
- **Trade-Up**: Upgrades to newer hardware at a discount (trade in old appliance). Choose this when the appliance is aging (3+ years), performance is insufficient, or the customer needs features only in newer models.
- **Lapsed subscriptions**: If security subscriptions expire, the appliance continues to route traffic but security services stop. Re-activation requires purchasing a new subscription.

## Common Recommendations

### Small Office (5–20 users)
Firebox T25 or T45 with Total Security Suite (3-Year). Add AuthPoint MFA for secure remote access.

### Mid-Size Business (50–200 users)
Firebox M290 or M390 with Total Security Suite (3-Year). Add WatchGuard EPDR for endpoint protection and AuthPoint Total Identity Security.

### Multi-Site / Branch Office
Hub: M-Series at HQ. Branches: T-Series at each site. All managed through WatchGuard Cloud with BOVPN (Branch Office VPN) between sites.

### Remote Workforce
AuthPoint MFA + EPDR on all endpoints. Firebox with Mobile VPN configured. Consider AuthPoint Total Identity Security for SSO and password management.

## Competitor Positioning

- **vs Fortinet**: WatchGuard is easier to deploy and manage, with a unified security platform. Fortinet requires more expertise but offers higher raw throughput at similar price points.
- **vs SonicWall**: Similar market positioning. WatchGuard has stronger cloud management and a more modern interface. SonicWall has a larger installed base in SMB.
- **vs Cisco Meraki**: Meraki is cloud-only management with simpler setup but less granular control. WatchGuard offers both cloud and on-premise management with deeper security features.

## Key Selling Points
- **Unified Security Platform**: Single pane of glass for network, endpoint, identity, and Wi-Fi security
- **WatchGuard Cloud**: Centralized management, reporting, and visibility across all products
- **ThreatSync (XDR)**: Cross-product threat correlation — network events + endpoint events analyzed together
- **Partner-Friendly**: 100% channel model, strong partner programs, competitive margins
