// Data region types — Phase 7 (`global.p7.multi_region_routing`).

/** AWS-style region identifiers, matching Supabase's supported project regions. */
export type DataRegion = 'ap-south-1' | 'eu-west-1' | 'us-east-1';

export interface RegionInfo {
  id: DataRegion;
  displayName: string;
  /** Whether this region has an actual provisioned Supabase project + API deployment today. */
  live: boolean;
}
