import React,{useEffect,useRef,useState}from"react";
import{createRoot}from"react-dom/client";
import{useRealtimeKitClient,RealtimeKitProvider}from"@cloudflare/realtimekit-react";
import{RtkMeeting,RtkParticipantTile}from"@cloudflare/realtimekit-react-ui";
import"./styles.css";

function Meeting({token}:{token:string}){
 const[meeting,initMeeting]=useRealtimeKitClient();
 const videoRef=useRef<HTMLVideoElement>(null);
 const[videoState,setVideoState]=useState("initializing");
 const[audioOn,setAudioOn]=useState(true);const[videoOn,setVideoOn]=useState(true);const[screenOn,setScreenOn]=useState(false);const[linkCopied,setLinkCopied]=useState(false);
 useEffect(()=>{
  let mounted=true;
  initMeeting({authToken:token,defaults:{audio:true,video:true}}).then((m:any)=>{
   if(!mounted||!m)return;
   try{
    const self=m.self;
    setVideoState(`joined=${!!self?.roomJoined} stage=${self?.stageStatus||m?.stage?.status||"unknown"} video=${!!self?.videoEnabled} track=${!!self?.videoTrack}`);
    if(videoRef.current&&self?.registerVideoElement){
     self.registerVideoElement(videoRef.current);
     if(self.enableVideo&&!self.videoEnabled)self.enableVideo();
    if(self.roomJoined&&m.stage?.join&&m.stage?.status!=="ON_STAGE")m.stage.join().catch(()=>{});
    }
   }catch{setVideoState("video attach error")}
  }).catch(()=>mounted&&setVideoState("meeting init error"));
  return()=>{mounted=false};
 },[token,initMeeting]);
 useEffect(()=>{
  if(!meeting)return;
  const update=()=>{
   const s:any=meeting.self;
   setVideoState(`joined=${!!s?.roomJoined} stage=${s?.stageStatus||meeting?.stage?.status||"unknown"} video=${!!s?.videoEnabled} track=${!!s?.videoTrack}`);
   try{if(videoRef.current&&s?.registerVideoElement)s.registerVideoElement(videoRef.current);if(s?.roomJoined&&meeting.stage?.join&&meeting.stage.status!=="ON_STAGE")meeting.stage.join().catch(()=>{})}catch{}
  };
  update();
  const t=window.setInterval(update,1000);
  return()=>window.clearInterval(t);
 },[meeting]);
 if(!meeting)return <div className="loading">Connecting to Bands Meet…</div>;
 const toggleAudio=async()=>{try{if(meeting.self.audioEnabled){await meeting.self.disableAudio();setAudioOn(false)}else{await meeting.self.enableAudio();setAudioOn(true)}}catch{}};
 const toggleVideo=async()=>{try{if(meeting.self.videoEnabled){await meeting.self.disableVideo();setVideoOn(false)}else{await meeting.self.enableVideo();setVideoOn(true)}}catch{}};
 const toggleScreen=async()=>{try{if(meeting.self.screenShareEnabled){await meeting.self.disableScreenShare();setScreenOn(false)}else{await meeting.self.enableScreenShare();setScreenOn(true)}}catch{}};
 const copyLink=async()=>{try{await navigator.clipboard.writeText(location.href);setLinkCopied(true);window.setTimeout(()=>setLinkCopied(false),1600)}catch{}};
 const leave=async()=>{try{await meeting.leave()}finally{location.href="/"}};
 return <RealtimeKitProvider value={meeting}>
  <div className="meeting-fullscreen">
   <RtkMeeting meeting={meeting} mode="fill" showSetupScreen={true}/>
   <div className="direct-stage"><RtkParticipantTile meeting={meeting} participant={meeting.self} isPreview={false} nameTagPosition="bottom-left" variant="solid" size="xl"/></div>
   <div className="meeting-topbar"><div className="meeting-title">Bands Meet</div><button className="link-button" onClick={copyLink}>{linkCopied?"✓ Link copied":"🔗 Copy meeting link"}</button></div>
   <div className="meeting-controls"><button className="control-btn" onClick={toggleAudio}>{audioOn?"🎙️ Mic":"🔇 Mic off"}</button><button className="control-btn" onClick={toggleVideo}>{videoOn?"📹 Camera":"🚫 Camera off"}</button><button className="control-btn" onClick={toggleScreen}>{screenOn?"🛑 Stop share":"🖥️ Share screen"}</button><button className="control-btn leave-btn" onClick={leave}>☎ Leave</button></div>
  </div>
 </RealtimeKitProvider>;
}

function App(){
 const[token,setToken]=useState("");const[meetingId,setMeetingId]=useState("");const[name,setName]=useState("");const[busy,setBusy]=useState(false);const[error,setError]=useState("");
 const createMeeting=async()=>{setBusy(true);setError("");try{const res=await fetch("/api/meetings",{method:"POST"});const data=await res.json();if(!res.ok)throw new Error(data.error||"Could not create meeting.");history.replaceState({}, "","/meeting/"+data.meetingId);setMeetingId(data.meetingId);setToken(data.token)}catch(e){setError(e instanceof Error?e.message:"Could not create meeting.")}finally{setBusy(false)}};
 const joinMeeting=async()=>{const id=meetingId.trim();if(!id)return setError("Enter a meeting ID or meeting link.");setBusy(true);setError("");try{const cleanId=id.includes("/meeting/")?id.split("/meeting/")[1].split(/[?#/]/)[0]:id;const res=await fetch("/api/meetings/"+encodeURIComponent(cleanId)+"/join",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({name})});const data=await res.json();if(!res.ok)throw new Error(data.error||"Could not join meeting.");history.replaceState({}, "","/meeting/"+cleanId);setMeetingId(cleanId);setToken(data.token)}catch(e){setError(e instanceof Error?e.message:"Could not join meeting.")}finally{setBusy(false)}};
 const pathId=location.pathname.match(/^\/meeting\/([^/]+)/)?.[1];useEffect(()=>{if(pathId)setMeetingId(pathId)},[pathId]);
 if(token)return <Meeting token={token}/>;
 return <main><section className="card"><div className="brand">Bands Meet</div><h1>Meet. Talk. Connect.</h1><p>Simple video meetings with clear audio and video.</p><input value={name} onChange={e=>setName(e.target.value)} placeholder="Your name"/><button onClick={createMeeting} disabled={busy}>{busy?"Creating…":"Create a meeting"}</button><div className="divider"><span>or join a meeting</span></div><input value={meetingId} onChange={e=>setMeetingId(e.target.value)} placeholder="Meeting ID or meeting link"/><button className="secondary" onClick={joinMeeting} disabled={busy}>{busy?"Joining…":"Join meeting"}</button>{error&&<div className="error">{error}</div>}</section></main>;
}
createRoot(document.getElementById("root")!).render(<App/>);