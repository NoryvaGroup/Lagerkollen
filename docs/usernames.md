# Username sign-in

An alias maps to an existing Auth user ID. No Auth user, password, email,
order, stock record or document is replaced or migrated. The initial alias
for the existing owner is `affe`; the owner can rename it after signing in.

`lagerkollen_usernames` has owner-only SELECT/INSERT/UPDATE policies. Anonymous
clients cannot enumerate aliases or read account emails. A server-only mapping
lookup precedes normal Supabase password authentication. Only successful Auth
tokens are returned; the frontend sets a normal Supabase session. Existing
email/password and email-link recovery paths remain available.

The username-login Edge Function intentionally disables the platform JWT check:
it is called before sign-in and authenticates the submitted password with Auth.
Never expose service-role keys, log credentials, or return account lookup data.
Origins are restricted, responses are no-store, bodies are limited, failures use
a generic credential error, and a service-only atomic RPC limits requests by
the platform-provided client IP (20 attempts per ten-minute window). Supabase
Auth's own protections also apply. The limiter stores only a SHA-256 IP hash.

The limiter uses SECURITY INVOKER and is executable only by service_role.
Do not grant clients direct access to the attempts table or RPC.
