// ============================================================
// CONFIGURACIÓN DEL BACKEND (Supabase)
// ------------------------------------------------------------
// La clave "anon" está DISEÑADA para ser pública: la seguridad
// real la dan las políticas RLS de la base de datos (ver
// setup-supabase.sql). Con estos dos campos rellenos, el sitio
// funciona en modo LIVE: los precios se leen de Supabase y los
// cambios del panel los ven todos los clientes.
// ============================================================
window.DECOGAS_CONFIG = {
  // Correo que recibe los avisos de nuevos clientes del formulario.
  // Cambiarlo aquí cuando se pase al correo de la empresa.
  notifyEmail: "dr4389742@gmail.com",
  supabaseUrl: "https://ygailcynbblqvugunleq.supabase.co",
  supabaseAnonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlnYWlsY3luYmJscXZ1Z3VubGVxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQxMDc2MzAsImV4cCI6MjA5OTY4MzYzMH0.nVAg5hfrZAfECDMNr30BoeMuXuyj_hy4c1LM-FnnY-Q",
  // Conversiones de Google Ads (etiqueta global en Base.astro, ASSET_V).
  googleAdsConversions: {
    formulario: "AW-18358011669/_fP4CIP_2NgcEJWO5LFE",
    llamada: "AW-18358011669/Bz6TCIb_2NgcEJWO5LFE",
    whatsapp: "AW-18358011669/-uE-CIn_2NgcEJWO5LFE"
  }
};
