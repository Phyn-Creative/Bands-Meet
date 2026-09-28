import React,{useEffect,useRef,useState}from"react";
import{createRoot}from"react-dom/client";
import{useRealtimeKitClient,RealtimeKitProvider}from"@cloudflare/realtimekit-react";
import{
 RtkUiProvider,RtkGrid,RtkSidebar,RtkNotifications,RtkParticipantsAudio,RtkDialogManager,
 RtkSetupScreen,RtkEndedScreen,RtkFullscreenToggle,RtkMicToggle,RtkCameraToggle,
 RtkScreenShareToggle,RtkSettingsToggle,RtkParticipantsToggle,RtkChatToggle,RtkLeaveButton
}from"@cloudflare/realtimekit-react-ui";
import"./styles.css";

const savedKey="bandsmeet.reusableMeetingId";

function Meeting({token,onLeave}:{token:string;onLeave:()=>void}){
 const[meeting,initMeeting]=useRealtimeKitClient();
 const[meetingState,setMeetingState]=useState("idle");
 const[uiStates,setUiStates]=useState<any>({meeting:"idle",activeSidebar:false,sidebar:"chat"});
 const[sidebar,setSidebar]=useState<"chat"|"participants"|null>(null);
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
   const enableMedia=()=>Promise.allSettled([
    m.self?.enableAudio?.(),
    m.self?.enableVideo?.()
   ]);
   try{
    if(m.self?.roomJoined)enableMedia();
    const onJoined=()=>enableMedia();
    m.self?.addListener?.("roomJoined",onJoined);
    (m as any).__bandsMeetCleanup=()=>m.self?.removeListener?.("roomJoined",onJoined);
   }catch{}
  }).catch((error)=>console.error("Bands Meet init error",error));
  return()=>{mounted=false;if(leaveTimer.current)window.clearTimeout(leaveTimer.current)};
 },[token,initMeeting]);

 if(!meeting)return <div className="loading">Connecting to Bands Meet…</div>;

 const copyLink=async()=>{
  try{await navigator.clipboard.writeText(location.href);setLinkCopied(true);window.setTimeout(()=>setLinkCopied(false),1600)}catch{}
 };
 const handleStatesUpdate=(event:any)=>{
  const next=event?.detail||{};
  if(next) setUiStates(next);
  const state=next?.meeting;
  if(state){
   setMeetingState(state);
   if(state==="ended")leaveTimer.current=window.setTimeout(onLeave,350);
  }
 };
 const openSidebar=(name:"chat"|"participants")=>{
  setSidebar(current=>current===name?null:name);
 };

 return <RealtimeKitProvider value={meeting}>
  <RtkUiProvider ref={setFullScreenTarget as any} meeting={meeting} showSetupScreen={true} onRtkStatesUpdate={handleStatesUpdate} className="rtk-root">
   <div className="meeting-fullscreen">
    {meetingState==="setup"&&<RtkSetupScreen meeting={meeting}/>}
    {meetingState==="joined"&&<>
     <div className="meeting-stage">
      <RtkGrid meeting={meeting}/>
     </div>
     {sidebar&&<div className="meeting-sidebar">
      <RtkSidebar
       meeting={meeting}
       defaultSection={sidebar as any}
       enabledSections={["chat","participants"] as any}
       states={uiStates}
       size="md"
      />
     </div>}
     <div className="meeting-controlbar">
      <RtkFullscreenToggle targetElement={fullScreenTarget as HTMLElement} size="md" variant="button"/>
      <RtkMicToggle size="md" variant="button"/>
      <RtkCameraToggle size="md" variant="button"/>
      <RtkScreenShareToggle size="md" variant="button"/>
      <RtkSettingsToggle size="md" variant="button"/>
      <span onClick={()=>openSidebar("chat")} className="control-wrapper"><RtkChatToggle meeting={meeting} size="md" variant="button"/></span>
      <span onClick={()=>openSidebar("participants")} className="control-wrapper"><RtkParticipantsToggle meeting={meeting} size="md" variant="button"/></span>
      <RtkLeaveButton size="md" variant="button"/>
     </div>
    </>}
    {meetingState==="ended"&&<RtkEndedScreen meeting={meeting}/>}
    {(meetingState==="idle"||meetingState==="waiting")&&<div className="loading">Connecting to Bands Meet…</div>}
    <RtkParticipantsAudio meeting={meeting}/>
    <RtkDialogManager meeting={meeting}/>
    <RtkNotifications meeting={meeting}/>
    <div className="meeting-topbar">
     <div className="meeting-title">Bands Meet</div>
     <button className="link-button" onClick={copyLink}>{linkCopied?"✓ Link copied":"🔗 Copy meeting link"}</button>
    </div>
   </div>
  </RtkUiProvider>
 </RealtimeKitProvider>;
}

function App(){
 const[token,setToken]=useState(""),[meetingId,setMeetingId]=useState(""),[name,setName]=useState("");
 const[email,setEmail]=useState(""),[password,setPassword]=useState(""),[authMode,setAuthMode]=useState<"signin"|"signup"|null>(null);
 const[busy,setBusy]=useState(false),[error,setError]=useState(""),[hostOpen,setHostOpen]=useState(false),[guestOpen,setGuestOpen]=useState(false);
 const[savedMeeting,setSavedMeeting]=useState(()=>localStorage.getItem(savedKey)||"");
 const[reusablePath,setReusablePath]=useState(false),[pathChecked,setPathChecked]=useState(false);

 const createMeeting=async(reusable=false)=>{
  setBusy(true);setError("");
  try{const res=await fetch("/api/meetings",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({reusable})}),data=await res.json();
   if(!res.ok)throw new Error(data.error||"Could not create meeting.");
   if(reusable){localStorage.setItem(savedKey,data.meetingId);setSavedMeeting(data.meetingId)}
   history.replaceState({},"","/meeting/"+data.meetingId);setMeetingId(data.meetingId);setToken(data.token);
  }catch(e){setError(e instanceof Error?e.message:"Could not create meeting")}finally{setBusy(false)}
 };
 const joinMeeting=async()=>{
  const id=meetingId.trim();if(!id)return setError("Enter a meeting ID or meeting link.");setBusy(true);setError("");
  try{const cleanId=id.includes("/meeting/")?id.split("/meeting/")[1].split(/[?#/]/)[0]:id;
   const res=await fetch("/api/meetings/"+encodeURIComponent(cleanId)+"/join",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({name})}),data=await res.json();
   if(!res.ok)throw new Error(data.error||"Could not join meeting.");history.replaceState({},"","/meeting/"+cleanId);setMeetingId(cleanId);setToken(data.token);
  }catch(e){setError(e instanceof Error?e.message:"Could not join meeting")}finally{setBusy(false)}
 };
 const hostSavedMeeting=async(id=savedMeeting)=>{
  if(!id)return;setBusy(true);setError("");
  try{const res=await fetch("/api/meetings/"+encodeURIComponent(id)+"/host",{method:"POST"}),data=await res.json();
   if(!res.ok)throw new Error(data.error||"Could not open reusable meeting.");history.replaceState({},"","/meeting/"+id);setMeetingId(id);setToken(data.token);
  }catch(e){setError(e instanceof Error?e.message:"Could not open reusable meeting")}finally{setBusy(false)}
 };
 const copySaved=async()=>{if(!savedMeeting)return;try{await navigator.clipboard.writeText(location.origin+"/meeting/"+savedMeeting);setError("Reusable meeting link copied.")}catch{setError("Could not copy the link.")}};
 const leaveMeeting=()=>{setToken("");setMeetingId("");history.replaceState({},"","/");setReusablePath(false);setPathChecked(true)};
 const submitAuth=(event:React.FormEvent)=>{
  event.preventDefault();setError("");if(!email.trim()||!password)return setError("Enter your email and password.");
  if(authMode==="signup"){localStorage.setItem("bandsmeet.account",JSON.stringify({email:email.trim(),password}));setAuthMode("signin");setError("Account created. Sign in to continue.")}
  else{const account=JSON.parse(localStorage.getItem("bandsmeet.account")||"null");if(!account||account.email!==email.trim()||account.password!==password)return setError("Invalid email or password.");localStorage.setItem("bandsmeet.session",email.trim());setAuthMode(null)}
 };
 const pathId=location.pathname.match(/^\/meeting\/([^/]+)/)?.[1];
 useEffect(()=>{if(!pathId){setPathChecked(true);return}setMeetingId(pathId);fetch("/api/meetings/"+encodeURIComponent(pathId)+"/info").then(r=>r.ok?r.json():null).then(data=>setReusablePath(Boolean(data?.reusable))).catch(()=>setReusablePath(false)).finally(()=>setPathChecked(true))},[pathId]);

 if(token)return <Meeting token={token} onLeave={leaveMeeting}/>;
 if(!pathChecked)return <div className="loading">Loading meeting…</div>;
 if(reusablePath)return <main><section className="card"><div className="brand">Bands Meet</div><h1>Join meeting</h1><p>This is a reusable meeting link.</p><input value={name} onChange={e=>setName(e.target.value)} placeholder="Your name"/><button onClick={joinMeeting} disabled={busy}>{busy?"Joining…":"Join as guest"}</button>{error&&<div className="error">{error}</div>}</section></main>;

 return <main className="home-shell"><section className="home-card">
  <div className="brand">Bands Meet</div><h1>Meet. Talk. Connect.</h1><p>Simple video meetings with clear audio and video.</p>
  {!hostOpen&&!guestOpen&&<><div className="role-grid">
   <button className="role-card" onClick={()=>setHostOpen(true)}><span className="role-icon">▣</span><strong>Host</strong><small>Create or reuse a meeting link</small></button>
   <button className="role-card" onClick={()=>setGuestOpen(true)}><span className="role-icon">↗</span><strong>Guest</strong><small>Join an existing meeting</small></button>
  </div><div className="auth-row"><span>Have an account?</span><button className="text-button" onClick={()=>setAuthMode("signin")}>Sign in</button><span>•</span><button className="text-button" onClick={()=>setAuthMode("signup")}>Sign up</button></div></>}
  {hostOpen&&<div className="flow-panel"><button className="back-button" onClick={()=>setHostOpen(false)}>← Back</button><h2>Host a meeting</h2><p>Choose how you want to start.</p>
   <button onClick={()=>createMeeting(false)} disabled={busy}>{busy?"Creating…":"Create new meeting link"}</button>
   <button className="reusable-button" onClick={()=>createMeeting(true)} disabled={busy}>Create reusable meeting link</button>
   {savedMeeting&&<><button className="secondary" onClick={hostSavedMeeting} disabled={busy}>Reuse existing meeting link</button><button className="mini-button full-mini" onClick={copySaved}>Copy existing link</button></>}
   {!savedMeeting&&<div className="helper">No reusable meeting has been saved on this device yet.</div>}
   <div className="auth-note">Sign in to keep your meetings and reuse them across devices.</div>
  </div>}
  {guestOpen&&<div className="flow-panel"><button className="back-button" onClick={()=>setGuestOpen(false)}>← Back</button><h2>Join a meeting</h2><p>Paste the meeting link or enter the meeting ID.</p><input value={name} onChange={e=>setName(e.target.value)} placeholder="Your name"/><input value={meetingId} onChange={e=>setMeetingId(e.target.value)} placeholder="Meeting ID or meeting link"/><button onClick={joinMeeting} disabled={busy}>{busy?"Joining…":"Join meeting"}</button></div>}
  {error&&<div className="error">{error}</div>}
 </section>
 {authMode&&<div className="auth-overlay"><form className="auth-card" onSubmit={submitAuth}><button type="button" className="close-auth" onClick={()=>{setAuthMode(null);setError("")}}>×</button><div className="brand">Bands Meet</div><h2>{authMode==="signup"?"Create your account":"Welcome back"}</h2><p>{authMode==="signup"?"Sign up to manage your meetings.":"Sign in to access your meetings."}</p><input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email address" autoComplete="email"/><input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Password" autoComplete={authMode==="signup"?"new-password":"current-password"}/><button type="submit">{authMode==="signup"?"Sign up":"Sign in"}</button><button type="button" className="text-button switch-auth" onClick={()=>setAuthMode(authMode==="signup"?"signin":"signup")}>{authMode==="signup"?"Already have an account? Sign in":"Don't have an account? Sign up"}</button>{error&&<div className="error">{error}</div>}</form></div>}
 </main>;
}
createRoot(document.getElementById("root")!).render(<App/>);
