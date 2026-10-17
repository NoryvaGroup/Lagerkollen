import {createUsernameHandler} from './handler.mjs';
const digest=async(value:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))).map(n=>n.toString(16).padStart(2,'0')).join('');
Deno.serve(createUsernameHandler({url:Deno.env.get('SUPABASE_URL'),serviceKey:Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),anonKey:Deno.env.get('SUPABASE_ANON_KEY'),fetch,digest}));
