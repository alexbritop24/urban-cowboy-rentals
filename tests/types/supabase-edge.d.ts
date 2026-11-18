// Match the Edge runtime's npm specifier to the same installed Supabase client
// types used by the application. Runtime resolution remains Deno's responsibility.
declare module 'npm:@supabase/supabase-js@2' {
  import { createClient } from '@supabase/supabase-js';
  export { createClient };
}
