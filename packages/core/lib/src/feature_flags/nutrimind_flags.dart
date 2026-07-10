// Type-safe feature flag key constants.
// All global.* flags default to false — existing India users see zero change.

abstract final class NutriMindFlagKeys {
  // Phase 1 — Country Intelligence Engine
  static const kGlobalCountryEngine        = 'global.p1.country_engine';
  static const kGlobalTravelTransitionUX   = 'global.p1.travel_transition_ux';

  // Phase 2 — Localization Engine
  static const kGlobalRTL                  = 'global.p2.localization_rtl';
  static const kGlobalTierBLanguages       = 'global.p2.tier_b_languages';
  static const kGlobalNumeralRendering     = 'global.p2.numeral_rendering';
  static const kGlobalCodeSwitching        = 'global.p2.code_switching';

  // Phase 3 — Global Food Database
  static const kGlobalUnifiedFoodSchema    = 'global.p3.unified_food_schema';
  static const kGlobalRegionalDevicePacks  = 'global.p3.regional_device_packs';
  static const kGlobalCoFIDIngestion       = 'global.p3.cofid_ingestion';

  // Phase 4 — Nutrition Rule Engine
  static const kGlobalMultiStandardRules   = 'global.p4.multi_standard_rules';
  static const kGlobalLifeStageRules       = 'global.p4.life_stage_rules';
  static const kGlobalConditionRules       = 'global.p4.condition_rules';
  static const kGlobalAllergenRegimeMap    = 'global.p4.allergen_regime_map';

  // Phase 5 — Grocery & Restaurant Intelligence
  static const kGlobalGroceryProviderChain = 'global.p5.grocery_provider_chain';
  static const kGlobalRestaurantETL        = 'global.p5.restaurant_etl';
  static const kGlobalEstimatedNutrition   = 'global.p5.estimated_nutrition_label';

  // Phase 6 — OCR & Voice AI
  static const kGlobalCloudOCRFallback     = 'global.p6.cloud_ocr_fallback';
  static const kGlobalLabelFormatRouter    = 'global.p6.label_format_router';
  static const kGlobalCloudSTT            = 'global.p6.cloud_stt';
  static const kGlobalWakeWord             = 'global.p6.wake_word';

  // Phase 7 — Multi-Region
  static const kGlobalMultiRegionRouting   = 'global.p7.multi_region_routing';
  static const kGlobalEdgeCaching          = 'global.p7.edge_caching';

  // Phase 8 — Privacy & Compliance
  static const kGlobalGDPRConsentFlow      = 'global.p8.gdpr_consent_flow';
  static const kGlobalDPDPConsentFlow      = 'global.p8.dpdp_consent_flow';
  static const kGlobalDSREndpoints         = 'global.p8.dsr_endpoints';

  // Phase 9 — Performance
  static const kGlobalIncrementalSync      = 'global.p9.incremental_regional_sync';
  static const kGlobalDeferredComponents   = 'global.p9.deferred_components';

  // Phase 10 — Country Onboarding v2
  static const kGlobalCountryOnboardingV2  = 'global.p10.country_onboarding_v2';

  // Phase 11 — AI Memory System
  static const kGlobalAIMemorySystem       = 'global.p11.ai_memory_system';

  // Phase 12 — Enterprise Scale & Reliability
  static const kGlobalAICostKillSwitch     = 'global.p12.ai_cost_kill_switch';
  static const kGlobalAIGatewaySemanticCache = 'global.p12.ai_gateway_semantic_cache';
  static const kGlobalK8sWorkerMigration   = 'global.p12.k8s_worker_migration';
  static const kGlobalDegradationLadder    = 'global.p12.degradation_ladder';

  // Phase 13 — Multi-Agent System
  static const kGlobalMultiAgentSystem     = 'global.p13.multi_agent_system';

  /// All flag keys — used for FlagSnapshot.allEnabled() in tests.
  static const List<String> all = [
    kGlobalCountryEngine,
    kGlobalTravelTransitionUX,
    kGlobalRTL,
    kGlobalTierBLanguages,
    kGlobalNumeralRendering,
    kGlobalCodeSwitching,
    kGlobalUnifiedFoodSchema,
    kGlobalRegionalDevicePacks,
    kGlobalCoFIDIngestion,
    kGlobalMultiStandardRules,
    kGlobalLifeStageRules,
    kGlobalConditionRules,
    kGlobalAllergenRegimeMap,
    kGlobalGroceryProviderChain,
    kGlobalRestaurantETL,
    kGlobalEstimatedNutrition,
    kGlobalCloudOCRFallback,
    kGlobalLabelFormatRouter,
    kGlobalCloudSTT,
    kGlobalWakeWord,
    kGlobalMultiRegionRouting,
    kGlobalEdgeCaching,
    kGlobalGDPRConsentFlow,
    kGlobalDPDPConsentFlow,
    kGlobalDSREndpoints,
    kGlobalIncrementalSync,
    kGlobalDeferredComponents,
    kGlobalCountryOnboardingV2,
    kGlobalAIMemorySystem,
    kGlobalAICostKillSwitch,
    kGlobalAIGatewaySemanticCache,
    kGlobalK8sWorkerMigration,
    kGlobalDegradationLadder,
    kGlobalMultiAgentSystem,
  ];
}
