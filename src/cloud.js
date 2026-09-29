import {createClient} from '@supabase/supabase-js';
const config=window.LAGERKOLLEN_CLOUD||{};
let client=null,session=null,listener=()=>{};
if(config.url&&config.publishableKey){
 client=createClient(config.url,config.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
 client.auth.onAuthStateChange((event,next)=>{session=next;setTimeout(()=>listener(event,next),0)});
}
window.Cloud={
 available:!!client,
 get user(){return session?.user||null},
 async init(onAuth){listener=onAuth;if(!client)return null;const {data,error}=await client.auth.getSession();if(error)throw error;session=data.session;return session?.user||null},
 async sendLink(email){if(!client)throw Error('Molnlagring är inte konfigurerad');let {error}=await client.auth.signInWithOtp({email,options:{emailRedirectTo:location.origin,shouldCreateUser:true}});if(error)throw error},
 async verifyCode(email,token){if(!client)throw Error('Molnlagring är inte konfigurerad');let {error}=await client.auth.verifyOtp({email,token,type:'email'});if(error)throw error},
 async signOut(){if(!client)return;let {error}=await client.auth.signOut();if(error)throw error},
 async read(){const {data,error}=await client.from('lagerkollen_state').select('revision,payload').eq('owner_id',session.user.id).maybeSingle();if(error)throw error;return data},
 async write(payload,revision){let result;if(revision===null){result=await client.from('lagerkollen_state').insert({owner_id:session.user.id,payload}).select('revision').single()}else{result=await client.from('lagerkollen_state').update({payload,revision:revision+1,updated_at:new Date().toISOString()}).eq('owner_id',session.user.id).eq('revision',revision).select('revision').maybeSingle()}
 if(result.error){if(result.error.code==='23505')return null;throw result.error}return result.data?.revision??null}
};
