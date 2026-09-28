import React,{useEffect,useRef,useState}from"react";
import{createRoot}from"react-dom/client";
import{useRealtimeKitClient,RealtimeKitProvider}from"@cloudflare/realtimekit-react";
import{createClient}from"@supabase/supabase-js";
import{
 RtkUiProvider,RtkMeeting,RtkGrid,RtkChat,RtkParticipants,RtkNotifications,RtkParticipantsAudio,RtkDialogManager,
 RtkSetupScreen,RtkEndedScreen,RtkFullscreenToggle,RtkMicToggle,RtkCameraToggle,
 RtkScreenShareToggle,RtkSettingsToggle,RtkParticipantsToggle,RtkChatToggle,RtkLeaveButton
}from"@cloudflare/realtimekit-react-ui";
import"./styles.css";

const savedKey="bandsmeet.reusableMeetingId";
const supabase=createClient("https://coysnamfmepuphxsnooo.supabase.co","sb_publishable_wlM7XUR972NlvpeebzT2TQ_cwfyViuc");

function Meeting({token,onLeave}:{token:string;onLeave:()=>void}){
 const [meeting,initMeeting]=useRealtimeKitClient();
 const [copied,setCopied]=useState(false);
 const copyMeetingLink=async()=>{
  try{
   await navigator.clipboard.writeText(location.href);
   setCopied(true);
   setTimeout(()=>setCopied(false),1800);
  }catch{
   setCopied(false);
  }
 };
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
  }).catch((error)=>console.error("Bands Meet init error",error));
  return()=>{mounted=false};
 },[token,initMeeting]);
 if(!meeting)return <div className="loading">Connecting to Bands Meet…</div>;
 return <RealtimeKitProvider value={meeting}>
  <div className="meeting-fullscreen">
   <button type="button" className="meeting-copy-link" onClick={copyMeetingLink}>{copied?"✓ Link copied":"Copy meeting link"}</button>
   <RtkMeeting meeting={meeting} showSetupScreen={true}/>
  </div>
 </RealtimeKitProvider>;
}

function App(){
 const[token,setToken]=useState(""),[meetingId,setMeetingId]=useState(""),[name,setName]=useState("");
 const[email,setEmail]=useState(""),[password,setPassword]=useState(""),[showPassword,setShowPassword]=useState(false),[authMode,setAuthMode]=useState<"signin"|"signup"|null>(null);
 const[busy,setBusy]=useState(false),[error,setError]=useState(""),[hostOpen,setHostOpen]=useState(false),[guestOpen,setGuestOpen]=useState(false),[authUser,setAuthUser]=useState<any>(null);
 const[savedMeeting,setSavedMeeting]=useState(()=>localStorage.getItem(savedKey)||"");
 const[reusablePath,setReusablePath]=useState(false),[pathChecked,setPathChecked]=useState(false);
 const[theme,setTheme]=useState<"dark"|"light">(()=>localStorage.getItem("bandsmeet.theme")==="light"?"light":"dark");
 const toggleTheme=()=>setTheme(current=>{const next=current==="dark"?"light":"dark";localStorage.setItem("bandsmeet.theme",next);return next});

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
  try{
   const check=await fetch("/api/meetings/"+encodeURIComponent(id)+"/info");
   const info=await check.json().catch(()=>({}));
   if(!check.ok||!info?.reusable){
    localStorage.removeItem(savedKey);setSavedMeeting("");throw new Error("That saved meeting link is no longer valid. Create a new reusable meeting link.");
   }
   const res=await fetch("/api/meetings/"+encodeURIComponent(id)+"/host",{method:"POST"}),data=await res.json();
   if(!res.ok)throw new Error(data.error||"Could not open reusable meeting.");
   history.replaceState({},"","/meeting/"+id);setMeetingId(id);setToken(data.token);
  }catch(e){setError(e instanceof Error?e.message:"Could not open reusable meeting")}finally{setBusy(false)}
 };
 const copySaved=async()=>{if(!savedMeeting)return;try{await navigator.clipboard.writeText(location.origin+"/meeting/"+savedMeeting);setError("Reusable meeting link copied.")}catch{setError("Could not copy the link.")}};
 const leaveMeeting=()=>{setToken("");setMeetingId("");history.replaceState({},"","/");setReusablePath(false);setPathChecked(true)};
 const submitAuth=async(event:React.FormEvent)=>{
  event.preventDefault();setError("");
  const cleanEmail=email.trim().toLowerCase();
  if(!cleanEmail||!password)return setError("Enter your email and password.");
  setBusy(true);
  try{
   if(authMode==="signup"){
    const{data,error}=await supabase.auth.signUp({email:cleanEmail,password,options:{emailRedirectTo:location.origin+"/"}});
    if(error)throw error;
    setAuthUser(data.user??null);setAuthMode(data.session?null:"signin");
    setError(data.session?"Account created and signed in.":"Account created. We sent a verification link to your email. Open it to verify your account, then come back and sign in.");
   }else{
    const{data,error}=await supabase.auth.signInWithPassword({email:cleanEmail,password});
    if(error)throw error;
    setAuthUser(data.user);setAuthMode(null);setEmail("");setPassword("");setError("");
   }
  }catch(e){setError(e instanceof Error?e.message:"Authentication failed.")}
  finally{setBusy(false)}
 };
 const pathId=location.pathname.match(/^\/meeting\/([^/]+)/)?.[1];
 useEffect(()=>{supabase.auth.getSession().then(({data})=>setAuthUser(data.session?.user??null));const{data:{subscription}}=supabase.auth.onAuthStateChange((_event,session)=>setAuthUser(session?.user??null));return()=>subscription.unsubscribe()},[]);
 useEffect(()=>{if(!pathId){setPathChecked(true);return}setMeetingId(pathId);fetch("/api/meetings/"+encodeURIComponent(pathId)+"/info").then(r=>r.ok?r.json():null).then(data=>setReusablePath(Boolean(data?.reusable))).catch(()=>setReusablePath(false)).finally(()=>setPathChecked(true))},[pathId]);

 if(token)return <Meeting token={token} onLeave={leaveMeeting}/>;
 if(!pathChecked)return <div className="loading">Loading meeting…</div>;
 if(pathId)return <main><section className="card"><div className="brand">Bands Meet</div><h1>Join meeting</h1><p>{reusablePath?"This is a reusable meeting link.":"Enter your name to join this meeting."}</p><input value={name} onChange={e=>setName(e.target.value)} placeholder="Your name"/><button onClick={joinMeeting} disabled={busy}>{busy?"Joining…":"Join as guest"}</button>{error&&<div className="error">{error}</div>}</section></main>;

 return <main className={"home-shell theme-"+theme}><section className="home-card">
  <div className="brand">Bands Meet</div><div className="home-theme-row"><span>{theme==="dark"?"Dark mode":"Light mode"}</span><button type="button" className="theme-switch" onClick={toggleTheme} aria-label="Toggle theme">{theme==="dark"?"☀ Light":"☾ Dark"}</button></div><h1><span>Meet</span><span>Connect</span><span>Join the Band</span></h1><p>Simple video meetings with clear audio and video.</p>
  {!hostOpen&&!guestOpen&&<><div className="role-grid">
   <button className="role-card" onClick={()=>setHostOpen(true)}><span className="role-icon">▣</span><strong>Host a Band</strong><small>Create or reuse a meeting link</small></button>
   <button className="role-card" onClick={()=>setGuestOpen(true)}><span className="role-icon">↗</span><strong>Join a Band</strong><small>Join an existing meeting</small></button>
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
 {authMode&&<div className="auth-overlay"><form className="auth-card" onSubmit={submitAuth}><button type="button" className="close-auth" onClick={()=>{setAuthMode(null);setError("")}}>×</button><div className="brand">Bands Meet</div><h2>{authMode==="signup"?"Create your account":"Welcome back"}</h2><p>{authMode==="signup"?"Sign up to manage your meetings.":"Sign in to access your meetings."}</p><input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email address" autoComplete="email"/><div className="password-wrap"><input type={showPassword?"text":"password"} value={password} onChange={e=>setPassword(e.target.value)} placeholder="Password" autoComplete={authMode==="signup"?"new-password":"current-password"}/><button type="button" className="password-toggle" onClick={()=>setShowPassword(v=>!v)} aria-label={showPassword?"Hide password":"Show password"}>{showPassword?"Hide":"Show"}</button></div><button type="submit" disabled={busy}>{busy?(authMode==="signup"?"Creating…":"Signing in…"):(authMode==="signup"?"Sign up":"Sign in")}</button><button type="button" className="text-button switch-auth" onClick={()=>setAuthMode(authMode==="signup"?"signin":"signup")}>{authMode==="signup"?"Already have an account? Sign in":"Don't have an account? Sign up"}</button>{error&&<div className="error">{error}</div>}</form></div>}
 </main>;
}
createRoot(document.getElementById("root")!).render(<App/>);
