import React,{useEffect,useState}from"react";
import{createRoot}from"react-dom/client";
import{useRealtimeKitClient,RealtimeKitProvider}from"@cloudflare/realtimekit-react";
import{RtkUiProvider,RtkGrid,RtkStage,RtkControlbar,RtkNotifications,RtkParticipantsAudio,RtkDialogManager,RtkSetupScreen,RtkEndedScreen,RtkFullscreenToggle}from"@cloudflare/realtimekit-react-ui";
import"./styles.css";

const savedKey="bandsmeet.reusableMeetingId";

function Meeting({token}:{token:string}){
 const[meeting,initMeeting]=useRealtimeKitClient();
 const[meetingState,setMeetingState]=useState("idle");
 const[linkCopied,setLinkCopied]=useState(false);
 const[fullScreenTarget,setFullScreenTarget]=useState<HTMLElement|null>(null);

 useEffect(()=>{
  let mounted=true;
  initMeeting({authToken:token,defaults:{audio:true,video:true,mediaConfiguration:{audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true,enableStereo:true,enableHighBitrate:true},screenshare:{frameRate:{ideal:30,max:30}}}}}).then((m:any)=>{
   if(!mounted||!m)return;
   try{if(m.self?.roomJoined){m.self.enableAudio?.().catch(()=>{});m.self.enableVideo?.().catch(()=>{});}}catch{}
  }).catch(()=>{});
  return()=>{mounted=false};
 },[token,initMeeting]);

 if(!meeting)return <div className="loading">Connecting to Bands Meet…</div>;

 const copyLink=async()=>{
  try{await navigator.clipboard.writeText(location.href);setLinkCopied(true);window.setTimeout(()=>setLinkCopied(false),1600)}catch{}
 };
 const handleStatesUpdate=(event:any)=>{const state=event?.detail?.meeting;if(state)setMeetingState(state)};

 return <RealtimeKitProvider value={meeting}>
  <RtkUiProvider meeting={meeting} showSetupScreen={true} onRtkStatesUpdate={handleStatesUpdate} className="rtk-root">
   <div ref={setFullScreenTarget} className="meeting-fullscreen">
    {meetingState==="setup"&&<RtkSetupScreen/>}
    {meetingState==="joined"&&<>
      <RtkStage className="meeting-stage"><RtkGrid/></RtkStage>
      <div className="meeting-controlbar"><RtkFullscreenToggle targetElement={fullScreenTarget}/><RtkControlbar/></div>
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

 const createMeeting=async(reusable=false)=>{
  setBusy(true);setError("");
  try{
   const res=await fetch("/api/meetings",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({reusable})});
   const data=await res.json();
   if(!res.ok)throw new Error(data.error||"Could not create meeting.");
   if(reusable){localStorage.setItem(savedKey,data.meetingId);setSavedMeeting(data.meetingId)}
   history.replaceState({}, "","/meeting/"+data.meetingId);
   setMeetingId(data.meetingId);setToken(data.token);
  }catch(e){setError(e instanceof Error?e.message:"Could not create meeting.")}finally{setBusy(false)}
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
   history.replaceState({}, "","/meeting/"+cleanId);
   setMeetingId(cleanId);setToken(data.token);
  }catch(e){setError(e instanceof Error?e.message:"Could not join meeting.")}finally{setBusy(false)}
 };

 const openSaved=()=>{if(savedMeeting){setMeetingId(savedMeeting);setError("")}};
 const copySaved=async()=>{if(!savedMeeting)return;try{await navigator.clipboard.writeText(location.origin+"/meeting/"+savedMeeting);setError("Reusable meeting link copied.")}catch{setError("Could not copy the link.")}};

 const pathId=location.pathname.match(/^\/meeting\/([^/]+)/)?.[1];
 useEffect(()=>{if(pathId)setMeetingId(pathId)},[pathId]);

 if(token)return <Meeting token={token}/>;

 return <main><section className="card">
  <div className="brand">Bands Meet</div>
  <h1>Meet. Talk. Connect.</h1>
  <p>Simple video meetings with clear audio and video.</p>
  <input value={name} onChange={e=>setName(e.target.value)} placeholder="Your name"/>
  <button onClick={()=>createMeeting(false)} disabled={busy}>{busy?"Creating…":"Create a meeting"}</button>
  <button className="reusable-button" onClick={()=>createMeeting(true)} disabled={busy}>Create reusable meeting</button>
  <div className="helper">Use a reusable meeting when the same link should work again for future sessions.</div>
  {savedMeeting&&<div className="saved-meeting">
   <div><strong>Your reusable meeting</strong><span>{savedMeeting.slice(0,8)}…</span></div>
   <div className="saved-actions"><button className="mini-button" onClick={openSaved}>Open</button><button className="mini-button" onClick={copySaved}>Copy link</button></div>
  </div>}
  <div className="divider"><span>or join a meeting</span></div>
  <input value={meetingId} onChange={e=>setMeetingId(e.target.value)} placeholder="Meeting ID or meeting link"/>
  <button className="secondary" onClick={joinMeeting} disabled={busy}>{busy?"Joining…":"Join meeting"}</button>
  {error&&<div className="error">{error}</div>}
 </section></main>;
}
createRoot(document.getElementById("root")!).render(<App/>);
