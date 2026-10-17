import {createClient} from '@supabase/supabase-js';
const config=window.LAGERKOLLEN_CLOUD||{};
let client=null,session=null,listener=()=>{},loginUsername='';
async function readUsername(){const id=session?.user?.id;if(!id){loginUsername='';return '';}try{const {data,error}=await client.from('lagerkollen_usernames').select('username').eq('user_id',id).maybeSingle();if(session?.user?.id===id)loginUsername=error?'':data?.username||'';}catch{if(session?.user?.id===id)loginUsername='';}return loginUsername;}
if(config.url&&config.publishableKey){
 client=createClient(config.url,config.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
 client.auth.onAuthStateChange((event,next)=>{if(session?.user?.id!==next?.user?.id)loginUsername='';session=next;setTimeout(async()=>{await readUsername();listener(event,next)},0)});
}
window.Cloud={
 available:!!client,
 get user(){return session?.user||null},
 get username(){return loginUsername},
 async init(onAuth){listener=onAuth;if(!client)return null;const {data,error}=await client.auth.getSession();if(error)throw error;session=data.session;await readUsername();return session?.user||null},
 async sendLink(email){if(!client)throw Error('Molnlagring är inte konfigurerad');let {error}=await client.auth.signInWithOtp({email,options:{emailRedirectTo:location.origin,shouldCreateUser:true}});if(error)throw error},
 async signInWithPassword(identifier,password){
  if(!client)throw Error('Molnlagring är inte konfigurerad');identifier=identifier.trim().normalize('NFC');
  if(identifier.includes('@')){const {data,error}=await client.auth.signInWithPassword({email:identifier,password});if(error)throw error;session=data.session;await readUsername();return data.user;}
  const result=await client.functions.invoke('username-login',{body:{username:identifier.toLowerCase(),password}});
  if(result.error){let message='Fel användarnamn eller lösenord.';try{const detail=await result.error.context?.json();if(detail?.error)message=String(detail.error).slice(0,200);}catch{}throw Error(message);}
  if(!result.data?.access_token||!result.data?.refresh_token)throw Error('Fel användarnamn eller lösenord.');
  const {data,error}=await client.auth.setSession({access_token:result.data.access_token,refresh_token:result.data.refresh_token});if(error)throw error;session=data.session;await readUsername();return data.user;
 },
 async setUsername(value){if(!session?.user)throw Error('Logga in först');const username=String(value).trim().normalize('NFC').toLowerCase();if(!/^[a-zåäö0-9][a-zåäö0-9._-]{2,31}$/.test(username))throw Error('Använd 3–32 tecken: a–z och åäö, siffror, punkt, bindestreck eller understreck.');const {data,error}=await client.from('lagerkollen_usernames').upsert({user_id:session.user.id,username,updated_at:new Date().toISOString()}).select('username').single();if(error)throw Error(error.code==='23505'?'Användarnamnet är upptaget. Välj ett annat.':'Kunde inte spara användarnamnet. Försök igen.');loginUsername=data.username;return loginUsername;},
 async setPassword(password){if(!session?.user)throw Error('Logga in först');const {error}=await client.auth.updateUser({password});if(error)throw error},
 async verifyCode(email,token){if(!client)throw Error('Molnlagring är inte konfigurerad');let {error}=await client.auth.verifyOtp({email,token,type:'email'});if(error)throw error},
 async signOut(){if(!client)return;let {error}=await client.auth.signOut();if(error)throw error},
 async listManuals(){if(!session?.user)throw Error('Logga in för att läsa anvisningar');const {data,error}=await client.from('lagerkollen_manuals').select('id,title,description,storage_path,file_name,page_count,file_bytes,created_at').eq('owner_id',session.user.id).order('title');if(error)throw error;return data||[]},
 async downloadManual(path){if(!session?.user)throw Error('Logga in för att läsa anvisningar');const {data,error}=await client.storage.from('lagerkollen-manuals').download(path);if(error)throw error;return data},
 async read(){const {data,error}=await client.from('lagerkollen_state').select('revision,payload').eq('owner_id',session.user.id).maybeSingle();if(error)throw error;return data},
 async write(payload,revision){let result;if(revision===null){result=await client.from('lagerkollen_state').insert({owner_id:session.user.id,payload}).select('revision').single()}else{result=await client.from('lagerkollen_state').update({payload,revision:revision+1,updated_at:new Date().toISOString()}).eq('owner_id',session.user.id).eq('revision',revision).select('revision').maybeSingle()}
 if(result.error){if(result.error.code==='23505')return null;throw result.error}return result.data?.revision??null}
};
