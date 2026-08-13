window.SUPABASE_CONFIG = {
  // Use Supabase on GitHub Pages and keep the local server as the localhost fallback.
  enabled: true,
  url: "https://pdrcrkxeyqxqgpwfxqpu.supabase.co",
  // This project's legacy public anon key is browser-safe and works with the current Supabase client.
  anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBkcmNya3hleXF4cWdwd2Z4cXB1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYxNzcwOTIsImV4cCI6MjEwMTc1MzA5Mn0.C_XIbwUXwMcp2ElCUyGPJqDtJcKB_DpeO0IA9B5--54",
  bucket: "wedding-gallery",
  folder: "gallery"
};

// To switch the wedding gallery fully to Supabase:
// 1. Set enabled: true
// 2. Paste your project URL
// 3. Paste your anon key
// 4. Run the SQL from supabase-setup.sql in your Supabase project
