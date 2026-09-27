import React,{useEffect,useRef,useState}from"react";
import{createRoot}from"react-dom/client";
import{useRealtimeKitClient,RealtimeKitProvider}from"@cloudflare/realtimekit-react";
import{RtkUiProvider,RtkGrid,RtkStage,RtkControlbar,RtkNotifications,RtkParticipantsAudio,RtkDialogManager,RtkSetupScreen,RtkEndedScreen,RtkFullscreenToggle}from"@cloudflare/realtimekit-react-ui";
import"./styles.css";

function Meeting({token}:{token:string}){
 const[meeting,initMeeting]=useRealtimeKitClient();
 const[meetingState,setMeetingState]=useState("idle");
 const[linkCopied,setLinkCopied]=useState(false);
 const[fullScreenRef]=useState(()=>({current:null as HTMLDivElement|null}));

 useEffect(()=>{
  let mounted=true;
  initMeeting({authToken:token,defaults:{audio:true,video:true,mediaConfiguration:{audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true,enableStereo:true,enableHighBitrate:true},screenshare:{frameRate:{ideal:30,max:30}}}}}).then((m:any)=>{
   if(!mounted||!m)return;
   try{
    const self=m.self;
    if(self?.roomJoined){
     self.enableAudio?.().catch(()=>{});
     self.enableVideo?.().catch(()=>{});
    }
   }catch{}
  }).catch(()=>{});
  return()=>{mounted=false};
 },[token,initMeeting]);

 if(!meeting)return <div className="loading">Connecting to Bands Meet…</div>;

 const copyLink=async()=>{
  try{await navigator.clipboard.writeText(location.href);setLinkCopied(true);window.setTimeout(()=>setLinkCopied(false),1600)}catch{}
 };

 const handleStatesUpdate=(event:any)=>{
  const state=event?.detail?.meeting;
  if(state)setMeetingState(state);
 };

 return <RealtimeKitProvider value={meeting}>
  <RtkUiProvider meeting={meeting} showSetupScreen={true} onRtkStatesUpdate={handleStatesUpdate} className="rtk-root">
   <div ref={el=>{fullScreenRef.current=el}} className="meeting-fullscreen">
    {meetingState==="setup"&&<RtkSetupScreen/>}
    {meetingState==="joined"&&<>
      <RtkStage className="meeting-stage"><RtkGrid/></RtkStage>
      <div className="meeting-controlbar"><RtkFullscreenToggle targetElement={fullScreenRef.current}/><RtkControlbar/></div>
    </>}
    {meetingState==="ended"&&<RtkEndedScreen/>}
    {(meetingState==="idle"||meetingState==="waiting")&&<div className="loading">Connecting to Bands Meet…</div>}
    <RtkParticipantsAudio/>
    <RtkDialogManager/>
    <RtkNotifications/>
    <div className="meeting-topbar">
     <div className="meeting-title">Bands Meet</div>
     <button className="link-button" onClick={copyLink}>{linkCopied?"✓ Link copied":"🔗 Copy meeting link"}</button>
    </div>
   </div>
  </RtkUiProvider>
 </RealtimeKitProvider>;
}

function App(){
 const[token,setToken]=useState("");const[meetingId,setMeetingId]=useState("");const[name,setName]=useState("");const[busy,setBusy]=useState(false);const[error,setError]=useState("");
 const createMeeting=async()=>{
  setBusy(true);setError("");
  try{const res=await fetch("/api/meetings",{method:"POST"});const data=await res.json();if(!res.ok)throw new Error(data.error||"Could not create meeting.");history.replaceState({},"","/meeting/"+data.meetingId);setMeetingId(data.meetingId);setToken(data.token)}
  catch(e){setError(e instanceof Error?e.message:"Could not create meeting.")}finally{setBusy(false)}
 };
 const joinMeeting=async()=>{
  const id=meetingId.trim();if(!id)return setError("Enter a meeting ID or meeting link.");setBusy(true);setError("");
  try{const cleanId=id.includes("/meeting/")?id.split("/meeting/")[1].split(/[?#/]/)[0]:id;const res=await fetch("/api/meetings/"+encodeURIComponent(cleanId)+"/join",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({name})});const data=await res.json();if(!res.ok)throw new Error(data.error||"Could not join meeting.");history.replaceState({},"","/meeting/"+cleanId);setMeetingId(cleanId);setToken(data.token)}
  catch(e){setError(e instanceof Error?e.message:"Could not join meeting.")}finally{setBusy(false)}
 };
 const pathId=location.pathname.match(/^\/meeting\/([^/]+)/)?.[1];
 useEffect(()=>{if(pathId)setMeetingId(pathId)},[pathId]);
 if(token)return <Meeting token={token}/>;
 return <main><section className="card"><div className="brand">Bands Meet</div><h1>Meet. Talk. Connect.</h1><p>Simple video meetings with clear audio and video.</p><input value={name} onChange={e=>setName(e.target.value)} placeholder="Your name"/><button onClick={createMeeting} disabled={busy}>{busy?"Creating…":"Create a meeting"}</button><div className="divider"><span>or join a meeting</span></div><input value={meetingId} onChange={e=>setMeetingId(e.target.value)} placeholder="Meeting ID or meeting link"/><button className="secondary" onClick={joinMeeting} disabled={busy}>{busy?"Joining…":"Join meeting"}</button>{error&&<div className="error">{error}</div>}</section></main>;
}
createRoot(document.getElementById("root")!).render(<App/>);
