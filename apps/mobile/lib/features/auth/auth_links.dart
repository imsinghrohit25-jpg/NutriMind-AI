/// Single Android deep link used for every Supabase Auth redirect: email
/// confirmation (signUp), password reset (resetPasswordForEmail), and OAuth
/// (signInWithOAuth). supabase_flutter's internal deep-link handler matches
/// incoming links purely by query/fragment params (`access_token`/`code`/
/// `error`...), not by host/path, so one registered scheme+host in
/// AndroidManifest.xml covers all three flows — no need for a separate entry
/// per auth action.
///
/// Must be present in Supabase Dashboard → Authentication → URL Configuration
/// → Redirect URLs, or GoTrue silently falls back to the project's Site URL
/// instead (the exact cause of the "opens localhost:3000" bug this constant
/// fixes).
const kAuthCallbackDeepLink = 'nutrimind://login-callback';
