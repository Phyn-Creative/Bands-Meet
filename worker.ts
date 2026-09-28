interface Env {
  ASSETS: Fetcher;
  CLOUDFLARE_ACCOUNT_ID: string;
  CLOUDFLARE_API_TOKEN: string;
  REALTIME_KIT_APP_ID: string;
  REALTIME_KIT_PRESET: string;
}

const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json","cache-control":"no-store"}});

async function rtk(env:Env,path:string,init:RequestInit={}){
  const res=await fetch("https://api.cloudflare.com/client/v4/accounts/"+env.CLOUDFLARE_ACCOUNT_ID+"/realtime/kit/"+env.REALTIME_KIT_APP_ID+path,{
    ...init,
    headers:{"content-type":"application/json",Authorization:"Bearer "+env.CLOUDFLARE_API_TOKEN,...(init.headers||{})}
  });
  const body=await res.text();
  let data:any;
  try{data=JSON.parse(body)}catch{data={raw:body}}
  if(!res.ok||data?.success===false)throw new Error(JSON.stringify(data));
  return data;
}

const presetConfig=()=>({
  max_screenshare_count:1,
  max_video_streams:{desktop:4,mobile:2},
  media:{
    screenshare:{frame_rate:30,quality:"hd"},
    video:{frame_rate:30,quality:"hd",simulcast:false},
    audio:{enable_high_bitrate:true,enable_stereo:false}
  },
  view_type:"GROUP_CALL"
});

const presetPermissions=(host:boolean)=>({
  accept_waiting_requests:host,
  can_accept_production_requests:false,
  can_change_participant_permissions:host,
  can_edit_display_name:true,
  can_livestream:false,
  can_record:host,
  can_spotlight:host,
  connected_meetings:{can_alter_connected_meetings:false,can_switch_connected_meetings:false,can_switch_to_parent_meeting:false},
  chat:{private:{can_receive:true,can_send:true,files:false,text:true},public:{can_send:true,files:false,text:true}},
  disable_participant_audio:host,
  disable_participant_screensharing:host,
  disable_participant_video:host,
  hidden_participant:false,
  kick_participant:host,
  pin_participant:true,
  plugins:{can_close:false,can_edit_config:false,can_start:false,config:{}},
  polls:{can_create:false,can_view:false,can_vote:false},
  recorder_type:"NONE",
  show_participant_list:true,
  waiting_room_type:"SKIP",
  media:{audio:{can_produce:"ALLOWED"},screenshare:{can_produce:"ALLOWED"},video:{can_produce:"ALLOWED"}}
});

async function ensurePreset(env:Env,name:string,host:boolean){
  const listed=await rtk(env,"/presets");
  const existing=(listed?.data||[]).find((p:any)=>p?.name===name);
  if(existing?.id){
    await rtk(env,"/presets/"+existing.id,{method:"PATCH",body:JSON.stringify({name,config:presetConfig(),permissions:presetPermissions(host),ui:{design_tokens:{border_radius:"rounded",border_width:"thin",colors:{background:{"1000":"#050807","600":"#07110e","700":"#0b1713","800":"#10201b","900":"#19382e"},brand:{"300":"#bff7df","400":"#6ee7b7","500":"#18a878","600":"#15966b","700":"#123b30"},danger:"#ef4444",success:"#22c55e",text:"#ffffff",text_on_brand:"#ffffff",video_bg:"#050807",warning:"#f59e0b"},spacing_base:4,theme:"dark"}}})});
    return existing.name;
  }
  const created=await rtk(env,"/presets",{
    method:"POST",
    body:JSON.stringify({name,config:presetConfig(),permissions:presetPermissions(host),ui:{design_tokens:{border_radius:"rounded",border_width:"thin",colors:{background:{"1000":"#050807","600":"#07110e","700":"#0b1713","800":"#10201b","900":"#19382e"},brand:{"300":"#bff7df","400":"#6ee7b7","500":"#18a878","600":"#15966b","700":"#123b30"},danger:"#ef4444",success:"#22c55e",text:"#ffffff",text_on_brand:"#ffffff",video_bg:"#050807",warning:"#f59e0b"},spacing_base:4,theme:"dark"}}})
  });
  const createdName=created?.data?.name;
  if(!createdName)throw new Error("RealtimeKit did not return the created preset.");
  return createdName;
}

async function api(request:Request,env:Env){
  const url=new URL(request.url);

  const infoMatch=url.pathname.match(/^\/api\/meetings\/([^/]+)\/info$/);
  if(request.method==="GET"&&infoMatch){
    const meetingId=decodeURIComponent(infoMatch[1]);
    const body=await rtk(env,"/meetings/"+meetingId);
    const meeting=Array.isArray(body?.data)?body.data[0]:body?.data;
    return json({meetingId,reusable:Boolean(meeting?.title?.includes("Reusable"))});
  }

  if(request.method==="POST"&&url.pathname==="/api/meetings"){
    const input=await request.json().catch(()=>({})) as {reusable?:boolean};
    const reusable=Boolean(input.reusable);
    const hostPreset=await ensurePreset(env,"bandsmeet_host_v2",true);
    const body=await rtk(env,"/meetings",{method:"POST",body:JSON.stringify({title:reusable?"Bands Meet Reusable":"Bands Meet"})});
    const meetingId=body?.data?.id;
    if(!meetingId)throw new Error("RealtimeKit did not return a meeting ID.");
    const participant=await rtk(env,"/meetings/"+meetingId+"/participants",{
      method:"POST",
      body:JSON.stringify({name:"Bands Meet Host",preset_name:hostPreset,custom_participant_id:crypto.randomUUID()})
    });
    const token=participant?.data?.token??participant?.data?.auth_token??participant?.data?.authToken;
    if(!token)throw new Error("RealtimeKit did not return a participant token.");
    return json({meetingId,token});
  }

  const hostMatch=url.pathname.match(/^\/api\/meetings\/([^/]+)\/host$/);
  if(request.method==="POST"&&hostMatch){
    const hostPreset=await ensurePreset(env,"bandsmeet_host_v2",true);
    const meetingId=decodeURIComponent(hostMatch[1]);
    const participant=await rtk(env,"/meetings/"+meetingId+"/participants",{
      method:"POST",
      body:JSON.stringify({name:"Bands Meet Host",preset_name:hostPreset,custom_participant_id:crypto.randomUUID()})
    });
    const token=participant?.data?.token??participant?.data?.auth_token??participant?.data?.authToken;
    if(!token)throw new Error("RealtimeKit did not return a participant token.");
    return json({meetingId,token});
  }

  const match=url.pathname.match(/^\/api\/meetings\/([^/]+)\/join$/);
  if(request.method==="POST"&&match){
    const guestPreset=await ensurePreset(env,"bandsmeet_guest_v2",false);
    const meetingId=decodeURIComponent(match[1]);
    const input=await request.json().catch(()=>({})) as {name?:string};
    const participant=await rtk(env,"/meetings/"+meetingId+"/participants",{
      method:"POST",
      body:JSON.stringify({name:input.name?.trim()||"Bands Meet Guest",preset_name:guestPreset,custom_participant_id:crypto.randomUUID()})
    });
    const token=participant?.data?.token??participant?.data?.auth_token??participant?.data?.authToken;
    if(!token)throw new Error("RealtimeKit did not return a participant token.");
    return json({meetingId,token});
  }

  return null;
}

export default{
  async fetch(request:Request,env:Env){
    try{
      if(new URL(request.url).pathname.startsWith("/api/")){
        const response=await api(request,env);
        if(response)return response;
      }
      return env.ASSETS.fetch(request);
    }catch(error){
      return json({error:error instanceof Error?error.message:"Unexpected server error"},500);
    }
  }
};
