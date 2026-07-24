/// A curated set of country calling codes for the registration phone field — deliberately not a
/// new pub dependency for this alone (no existing package in this project already covers it;
/// pulling one in for a single dropdown wasn't worth the added surface). Not exhaustive, but
/// covers the large majority of real users across every populated continent.
class DialCode {
  const DialCode({required this.iso, required this.name, required this.dialCode});
  final String iso;
  final String name;
  final String dialCode;
}

const kDialCodes = <DialCode>[
  DialCode(iso: 'US', name: 'United States', dialCode: '+1'),
  DialCode(iso: 'CA', name: 'Canada', dialCode: '+1'),
  DialCode(iso: 'GB', name: 'United Kingdom', dialCode: '+44'),
  DialCode(iso: 'IN', name: 'India', dialCode: '+91'),
  DialCode(iso: 'AU', name: 'Australia', dialCode: '+61'),
  DialCode(iso: 'DE', name: 'Germany', dialCode: '+49'),
  DialCode(iso: 'FR', name: 'France', dialCode: '+33'),
  DialCode(iso: 'ES', name: 'Spain', dialCode: '+34'),
  DialCode(iso: 'IT', name: 'Italy', dialCode: '+39'),
  DialCode(iso: 'NL', name: 'Netherlands', dialCode: '+31'),
  DialCode(iso: 'PT', name: 'Portugal', dialCode: '+351'),
  DialCode(iso: 'IE', name: 'Ireland', dialCode: '+353'),
  DialCode(iso: 'SE', name: 'Sweden', dialCode: '+46'),
  DialCode(iso: 'NO', name: 'Norway', dialCode: '+47'),
  DialCode(iso: 'DK', name: 'Denmark', dialCode: '+45'),
  DialCode(iso: 'FI', name: 'Finland', dialCode: '+358'),
  DialCode(iso: 'CH', name: 'Switzerland', dialCode: '+41'),
  DialCode(iso: 'AT', name: 'Austria', dialCode: '+43'),
  DialCode(iso: 'PL', name: 'Poland', dialCode: '+48'),
  DialCode(iso: 'BR', name: 'Brazil', dialCode: '+55'),
  DialCode(iso: 'MX', name: 'Mexico', dialCode: '+52'),
  DialCode(iso: 'AR', name: 'Argentina', dialCode: '+54'),
  DialCode(iso: 'CL', name: 'Chile', dialCode: '+56'),
  DialCode(iso: 'CO', name: 'Colombia', dialCode: '+57'),
  DialCode(iso: 'ZA', name: 'South Africa', dialCode: '+27'),
  DialCode(iso: 'NG', name: 'Nigeria', dialCode: '+234'),
  DialCode(iso: 'KE', name: 'Kenya', dialCode: '+254'),
  DialCode(iso: 'EG', name: 'Egypt', dialCode: '+20'),
  DialCode(iso: 'AE', name: 'United Arab Emirates', dialCode: '+971'),
  DialCode(iso: 'SA', name: 'Saudi Arabia', dialCode: '+966'),
  DialCode(iso: 'IL', name: 'Israel', dialCode: '+972'),
  DialCode(iso: 'TR', name: 'Turkey', dialCode: '+90'),
  DialCode(iso: 'RU', name: 'Russia', dialCode: '+7'),
  DialCode(iso: 'CN', name: 'China', dialCode: '+86'),
  DialCode(iso: 'JP', name: 'Japan', dialCode: '+81'),
  DialCode(iso: 'KR', name: 'South Korea', dialCode: '+82'),
  DialCode(iso: 'SG', name: 'Singapore', dialCode: '+65'),
  DialCode(iso: 'MY', name: 'Malaysia', dialCode: '+60'),
  DialCode(iso: 'TH', name: 'Thailand', dialCode: '+66'),
  DialCode(iso: 'ID', name: 'Indonesia', dialCode: '+62'),
  DialCode(iso: 'PH', name: 'Philippines', dialCode: '+63'),
  DialCode(iso: 'VN', name: 'Vietnam', dialCode: '+84'),
  DialCode(iso: 'PK', name: 'Pakistan', dialCode: '+92'),
  DialCode(iso: 'BD', name: 'Bangladesh', dialCode: '+880'),
  DialCode(iso: 'LK', name: 'Sri Lanka', dialCode: '+94'),
  DialCode(iso: 'NZ', name: 'New Zealand', dialCode: '+64'),
];
