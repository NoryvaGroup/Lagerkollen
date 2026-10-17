// No credentials or tokens are logged. All privileged keys stay in the runtime.
export function createUsernameHandler({url,serviceKey,anonKey,fetch:request,digest}){
 const origins=new Set(['https://lagerkollen.vercel.app','https://lagerkollen-noryva.vercel.app','https://lagerkollen-git-main-noryva.vercel.app']);
 return async req=>{
  const origin=req.headers.get('origin');
  const headers={'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Vary':'Origin',...(origin&&origins.has(origin)?{'Access-Control-Allow-Origin':origin}:{})};
  const respond=(status,error)=>new Response(JSON.stringify(error),{status,headers});
  const invalid=()=>respond(401,{error:'Fel användarnamn eller lösenord.'});
  if(origin&&!origins.has(origin))return respond(403,{error:'Otillåten begäran.'});
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers:{...headers,'Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'authorization, apikey, x-client-info, content-type'}});
  if(req.method!=='POST')return respond(405,{error:'Använd POST.'});
  if(!url||!serviceKey||!anonKey)return respond(503,{error:'Inloggning är tillfälligt otillgänglig.'});
  try{
   if(!req.headers.get('content-type')?.includes('application/json')||Number(req.headers.get('content-length')||0)>4096)return invalid();
   const reader=req.body?.getReader();if(!reader)return invalid();let size=0,parts=[];
   while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>4096){await reader.cancel();return invalid();}parts.push(value);}
   const bytes=new Uint8Array(size);let offset=0;for(const p of parts){bytes.set(p,offset);offset+=p.length;}
   const body=JSON.parse(new TextDecoder().decode(bytes)),username=String(body.username||'').trim().toLowerCase(),password=body.password;
   if(!/^[a-z0-9][a-z0-9._-]{2,31}$/.test(username)||typeof password!=='string'||!password.length||password.length>256)return invalid();
   // Cloudflare supplies this header. Ignore caller-controlled forwarded-for headers.
   const rawIp=req.headers.get('cf-connecting-ip')||'',ip=/^[0-9a-fA-F:.]{3,64}$/.test(rawIp)?rawIp:'unknown';
   const key=await digest('lagerkollen-username-login:'+ip);
   const privileged={apikey:serviceKey,Authorization:'Bearer '+serviceKey,'Content-Type':'application/json'};
   const quota=await request(url+'/rest/v1/rpc/consume_username_login',{method:'POST',headers:privileged,body:JSON.stringify({p_key:key})});
   if(!quota.ok)return respond(503,{error:'Inloggning är tillfälligt otillgänglig.'});
   if(await quota.json()!==true)return respond(429,{error:'För många försök. Vänta tio minuter och försök igen.'});
   const aliases=await request(url+'/rest/v1/lagerkollen_usernames?username=eq.'+encodeURIComponent(username)+'&select=user_id&limit=1',{headers:privileged});
   if(!aliases.ok)return respond(503,{error:'Inloggning är tillfälligt otillgänglig.'});
   const alias=(await aliases.json())[0],userId=alias?.user_id||'00000000-0000-0000-0000-000000000000';
   const account=await request(url+'/auth/v1/admin/users/'+userId,{headers:privileged});
   const user=account.ok?await account.json():null,email=user?.email||'nonexistent@lagerkollen.invalid';
   const login=await request(url+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:anonKey,'Content-Type':'application/json'},body:JSON.stringify({email,password})});
   const result=await login.json();
   if(!login.ok||!alias||result.user?.id!==userId||!result.access_token||!result.refresh_token)return invalid();
   return respond(200,{access_token:result.access_token,refresh_token:result.refresh_token});
  }catch{return respond(503,{error:'Inloggning är tillfälligt otillgänglig. Försök igen.'});}
 };
}
