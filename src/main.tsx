import React,{useEffect,useRef,useState}from"react";
import{createRoot}from"react-dom/client";
import{useRealtimeKitClient,RealtimeKitProvider}from"@cloudflare/realtimekit-react";
import{
 RtkUiProvider,RtkGrid,RtkStage,RtkNotifications,RtkParticipantsAudio,RtkDialogManager,
 RtkSetupScreen,RtkEndedScreen,RtkFullscreenToggle,RtkMicToggle,RtkCameraToggle,
 RtkScreenShareToggle,RtkSettingsToggle,RtkParticipantsToggle,RtkChatToggle,RtkLeaveButton
}from"@cloudflare/realtimekit-react-ui";
import"./styles.css";

const savedKey="bandsmeet.reusableMeetingId";

function Meeting({token,onLeave}:{token:string;onLeave:()=>void}){
 const[meeting,initMeeting]=useRealtimeKitClient();
 const[meetingState,setMeetingState]=useState("idle");
 const[linkCopied,setLinkCopied]=useState(false);
 const[fullScreenTarget,setFullScreenTarget]=useState<HTMLElement|null>(null);
 const leaveTimer=useRef<number|undefined>(undefined);

 useEffect(()=>{
  let mounted=true;
  initMeeting({
   authToken:token,
   defaults:{
    audio:true,
    video:true,
    mediaConfiguration:{
     audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true,enableStereo:false,enableHighBitrate:true},
     video:{width:{ideal:1280},height:{ideal:720},frameRate:{ideal:30}},
     screenshare:{frameRate:{ideal:30,max:30},displaySurface:"monitor"}
    }
   },
   overrides:{simulcastConfig:{disable:true}},
   onError:(error:any)=>console.error("Bands Meet SDK error",error)
  }).then((m:any)=>{
   if(!mounted||!m)return;
   try{if(m.self?.roomJoined){m.self.enableAudio?.().catch(()=>{});m.self.enableVideo?.().catch(()=>{});}}catch{}
  }).catch((error)=>console.error("Bands Meet init error",error));
  return()=>{mounted=false;if(leaveTimer.current)window.clearTimeout(leaveTimer.current)};
 },[token,initMeeting]);

 if(!meeting)return <div className="loading">Connecting to Bands Meet…</div>;

 const copyLink=async()=>{
  try{await navigator.clipboard.writeText(location.href);setLinkCopied(true);window.setTimeout(()=>setLinkCopied(false),1600)}catch{}
 };
 const handleStatesUpdate=(event:any)=>{
  const state=event?.detail?.meeting;
  if(state){
   setMeetingState(state);
   if(state==="ended"){
    leaveTimer.current=window.setTimeout(onLeave,350);
   }
  }
 };

 return <RealtimeKitProvider value={meeting}>
  <RtkUiProvider ref={setFullScreenTarget as any} meeting={meeting} showSetupScreen={true} onRtkStatesUpdate={handleStatesUpdate} className="rtk-root">
   <div className="meeting-fullscreen">
    {meetingState==="setup"&&<RtkSetupScreen/>}
    {meetingState==="joined"&&<>
     <RtkStage className="meeting-stage"><RtkGrid/></RtkStage>
     <div className="meeting-controlbar">
      <RtkFullscreenToggle targetElement={fullScreenTarget as HTMLElement} size="md" variant="button"/>
      <RtkMicToggle size="md" variant="button"/>
      <RtkCameraToggle size="md" variant="button"/>
      <RtkScreenShareToggle size="md" variant="button"/>
      <RtkSettingsToggle size="md" variant="button"/>
      <RtkChatToggle size="md" variant="button"/>
      <RtkParticipantsToggle size="md" variant="button"/>
      <RtkLeaveButton size="md" variant="button"/>
     </div>
    </>}
    {meetingState==="ended"&&<RtkEndedScreen/>}
    {(meetingState==="idle"||meetingState==="waiting")&&<div className="loading">Connecting to Bands Meet…</div>}
    <RtkParticipantsAudio/><RtkDialogManager/><RtkNotifications/>
    <div className="meeting-topbar">
     <div className="meeting-title">Bands Meet</div>
     <button className="link-button" onClick={copyLink}>{linkCopied?"✓ Link copied":"🔗 Copy meeting link"}</button>
    </div>
   </div>
  </RtkUiProvider>
 </RealtimeKitProvider>;
}

function App(){
 const[token,setToken]=useState("");
 const[meetingId,setMeetingId]=useState("");
 const[name,setName]=useState("");
 const[busy,setBusy]=useState(false);
 const[error,setError]=useState("");
 const[savedMeeting,setSavedMeeting]=useState(()=>localStorage.getItem(savedKey)||"");
 const[reusablePath,setReusablePath]=useState(false);
 const[pathChecked,setPathChecked]=useState(false);

 const createMeeting=async(reusable=false)=>{
  setBusy(true);setError("");
  try{
   const res=await fetch("/api/meetings",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({reusable})});
   const data=await res.json();
   if(!res.ok)throw new Error(data.error||"Could not create meeting.");
   if(reusable){localStorage.setItem(savedKey,data.meetingId);setSavedMeeting(data.meetingId)}
   history.replaceState({},"","/meeting/"+data.meetingId);
   setMeetingId(data.meetingId);setToken(data.token);
  }catch(e){setError(e instanceof Error?e.message:"Could not create meeting")}finally{setBusy(false)}
 };

 const joinMeeting=async()=>{
  const id=meetingId.trim();
  if(!id)return setError("Enter a meeting ID or meeting link.");
  setBusy(true);setError("");
  try{
   const cleanId=id.includes("/meeting/")?id.split("/meeting/")[1].split(/[?#/]/)[0]:id;
   const res=await fetch("/api/meetings/"+encodeURIComponent(cleanId)+"/join",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({name})});
   const data=await res.json();
   if(!res.ok)throw new Error(data.error||"Could not join meeting.");
   history.replaceState({},"","/meeting/"+cleanId);
   setMeetingId(cleanId);setToken(data.token);
  }catch(e){setError(e instanceof Error?e.message:"Could not join meeting")}finally{setBusy(false)}
 };

 const hostSavedMeeting=async(id=savedMeeting)=>{
  if(!id)return;
  setBusy(true);setError("");
  try{
   const res=await fetch("/api/meetings/"+encodeURIComponent(id)+"/host",{method:"POST"});
   const data=await res.json();
   if(!res.ok)throw new Error(data.error||"Could not open reusable meeting.");
   history.replaceState({},"","/meeting/"+id);
   setMeetingId(id);setToken(data.token);
  }catch(e){setError(e instanceof Error?e.message:"Could not open reusable meeting")}finally{setBusy(false)}
 };
 const copySaved=async()=>{if(!savedMeeting)return;try{await navigator.clipboard.writeText(location.origin+"/meeting/"+savedMeeting);setError("Reusable meeting link copied.")}catch{setError("Could not copy the link.")}};
 const openSaved=()=>{if(savedMeeting){setMeetingId(savedMeeting);setReusablePath(true);setError("")}};
 const leaveMeeting=()=>{setToken("");setMeetingId("");history.replaceState({},"","/");setReusablePath(false);setPathChecked(true)};

 const pathId=location.pathname.match(/^\/meeting\/([^/]+)/)?.[1];
 useEffect(()=>{
  if(!pathId){setPathChecked(true);return}
  setMeetingId(pathId);
  fetch("/api/meetings/"+encodeURIComponent(pathId)+"/info")
   .then(r=>r.ok?r.json():null)
   .then(data=>setReusablePath(Boolean(data?.reusable)))
   .catch(()=>setReusablePath(false))
   .finally(()=>setPathChecked(true));
 },[pathId]);

 if(token)return <Meeting token={token} onLeave={leaveMeeting}/>;
 if(!pathChecked)return <div className="loading">Loading meeting…</div>;

 return <main><section className="card">
  <div className="brand">Bands Meet</div>
  <h1>{reusablePath?"Reusable meeting":"Meet. Talk. Connect."}</h1>
  <p>{reusablePath?"This meeting link can be used again for future sessions.":"Simple video meetings with clear audio and video."}</p>
  <input value={name} onChange={e=>setName(e.target.value)} placeholder="Your name"/>
  {reusablePath&&<button onClick={()=>hostSavedMeeting(pathId)} disabled={busy}>{busy?"Opening…":"Host this reusable meeting"}</button>}
  {reusablePath&&<div className="helper reusable-note">Use the same link again whenever you want to host another session.</div>}
  {!reusablePath&&<button onClick={()=>createMeeting(false)} disabled={busy}>{busy?"Creating…":"Create a meeting"}</button>}
  {!reusablePath&&<button className="reusable-button" onClick={()=>createMeeting(true)} disabled={busy}>Create reusable meeting</button>}
  {!reusablePath&&<div className="helper">Use a reusable meeting when the same link should work again for future sessions.</div>}
  {savedMeeting&&<div className="saved-meeting">
   <div><strong>Your reusable meeting</strong><span>{savedMeeting.slice(0,8)}…</span></div>
   <div className="saved-actions"><button className="mini-button" onClick={hostSavedMeeting} disabled={busy}>Host meeting</button><button className="mini-button" onClick={copySaved}>Copy link</button></div>
  </div>}
  <div className="divider"><span>or join a meeting</span></div>
  <input value={meetingId} onChange={e=>setMeetingId(e.target.value)} placeholder="Meeting ID or meeting link"/>
  <button className="secondary" onClick={joinMeeting} disabled={busy}>{busy?"Joining…":"Join meeting"}</button>
  {reusablePath&&<button className="secondary" onClick={joinMeeting} disabled={busy}>Join as guest</button>}
  {error&&<div className="error">{error}</div>}
 </section></main>;
}
createRoot(document.getElementById("root")!).render(<App/>);
