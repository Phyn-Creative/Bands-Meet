interface Env {
  ASSETS: Fetcher;
  CLOUDFLARE_ACCOUNT_ID: string;
  CLOUDFLARE_API_TOKEN: string;
  REALTIME_KIT_APP_ID: string;
  REALTIME_KIT_PRESET: string;
}
const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json","cache-control":"no-store"}});
async function rtk(env:Env,path:string,init:RequestInit={}){
  const res=await fetch("https://api.cloudflare.com/client/v4/accounts/"+env.CLOUDFLARE_ACCOUNT_ID+"/realtime/kit/"+env.REALTIME_KIT_APP_ID+path,{...init,headers:{"content-type":"application/json",Authorization:"Bearer "+env.CLOUDFLARE_API_TOKEN,...(init.headers||{})}});
  const body=await res.text(); let data:any; try{data=JSON.parse(body)}catch{data={raw:body}}
  if(!res.ok||data?.success===false)throw new Error(data?.errors?.[0]?.message||data?.message||("RealtimeKit API error ("+res.status+")"));
  return data;
}
async function api(request:Request,env:Env){
  const url=new URL(request.url);
  if(request.method==="POST"&&url.pathname==="/api/meetings"){
    const body=await rtk(env,"/meetings",{method:"POST",body:JSON.stringify({title:"Bands Meet"})});
    const meetingId=body?.data?.id;if(!meetingId)throw new Error("RealtimeKit did not return a meeting ID.");
    const participant=await rtk(env,"/meetings/"+meetingId+"/participants",{method:"POST",body:JSON.stringify({name:"Bands Meet Host",preset_name:env.REALTIME_KIT_PRESET,custom_participant_id:crypto.randomUUID()})});
    const token=participant?.data?.token??participant?.data?.auth_token??participant?.data?.authToken;if(!token)throw new Error("RealtimeKit did not return a participant token.");
    return json({meetingId,token});
  }
  const match=url.pathname.match(/^\/api\/meetings\/([^/]+)\/join$/);
  if(request.method==="POST"&&match){
    const meetingId=decodeURIComponent(match[1]);const input=await request.json().catch(()=>({})) as {name?:string};
    const participant=await rtk(env,"/meetings/"+meetingId+"/participants",{method:"POST",body:JSON.stringify({name:input.name?.trim()||"Bands Meet Guest",preset_name:env.REALTIME_KIT_PRESET,custom_participant_id:crypto.randomUUID()})});
    const token=participant?.data?.token??participant?.data?.auth_token??participant?.data?.authToken;if(!token)throw new Error("RealtimeKit did not return a participant token.");
    return json({meetingId,token});
  }
  return null;
}
export default{async fetch(request:Request,env:Env){try{if(new URL(request.url).pathname.startsWith("/api/")){const response=await api(request,env);if(response)return response}return env.ASSETS.fetch(request)}catch(error){return json({error:error instanceof Error?error.message:"Unexpected server error"},500)}}};