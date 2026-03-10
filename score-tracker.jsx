import { useState, useEffect, useCallback } from "react";

// ─── Constants ────────────────────────────────────────────────────────────────
const GAMES = ["Icebreaker","Tactics","K1","WS1","WS2","K2","K3","WS3","WS4","WS5","K4"];

const TEAM_COLORS = [
  "#C8102E","#003DA5","#00A8E0","#FF6900","#7B2D8B","#0077A8","#E4002B","#005F9E",
];

const STORAGE_KEY = "cmc-tracker-v3";

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Anton&family=Barlow+Condensed:wght@400;600;700;900&family=Barlow:wght@400;500;600;700&display=swap');

  :root {
    --rb-red: #C8102E;
    --rb-navy: #001E62;
    --rb-blue: #003DA5;
    --rb-sky: #00A8E0;
    --rb-white: #FFFFFF;
    --rb-offwhite: #F4F5F7;
    --rb-light: #E8EBF0;
    --rb-border: #D0D5DE;
    --rb-text: #0A0F1E;
    --rb-muted: #5A6478;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Barlow', sans-serif; background: var(--rb-offwhite); color: var(--rb-text); min-height: 100vh; }

  @keyframes fadeUp {
    from { opacity:0; transform:translateY(16px); }
    to   { opacity:1; transform:translateY(0); }
  }
  @keyframes barGrow { from { width: 0 } }
  @keyframes confettiFall { to { transform:translateY(105vh) rotate(600deg); opacity:0; } }
  @keyframes podiumRise {
    from { transform:scaleY(0); transform-origin:bottom; }
    to   { transform:scaleY(1); transform-origin:bottom; }
  }
  @keyframes shimmer {
    0%   { background-position:-200% center; }
    100% { background-position: 200% center; }
  }
  @keyframes trophyDrop {
    0%   { transform:scale(0.2) translateY(-40px); opacity:0; }
    70%  { transform:scale(1.15) translateY(4px); opacity:1; }
    100% { transform:scale(1) translateY(0); opacity:1; }
  }
  @keyframes rowIn {
    from { opacity:0; transform:translateX(-20px); }
    to   { opacity:1; transform:translateX(0); }
  }

  .fade-up     { animation: fadeUp 0.4s ease both; }
  .podium-rise { animation: podiumRise 0.65s cubic-bezier(0.34,1.56,0.64,1) both; }
  .trophy-drop { animation: trophyDrop 0.7s cubic-bezier(.36,.07,.19,.97) both; }
  .row-in      { animation: rowIn 0.4s ease both; }

  .tab-bar { display:flex; background:white; border-bottom:3px solid var(--rb-navy); }
  .tab-btn {
    flex:1; padding:13px 8px; border:none; background:white;
    font-family:'Barlow Condensed',sans-serif; font-size:15px; font-weight:700;
    letter-spacing:0.08em; text-transform:uppercase; color:var(--rb-muted);
    cursor:pointer; border-bottom:3px solid transparent; margin-bottom:-3px;
    transition:color 0.15s, border-color 0.15s;
  }
  .tab-btn.active { color:var(--rb-navy); border-bottom-color:var(--rb-red); }
  .tab-btn:hover:not(.active) { color:var(--rb-navy); }

  .score-input {
    width:68px; padding:8px 6px; border:2px solid var(--rb-border);
    font-family:'Barlow Condensed',sans-serif; font-size:20px; font-weight:700;
    text-align:center; color:var(--rb-text); background:var(--rb-offwhite); outline:none;
    transition:border-color 0.15s, background 0.15s;
    -moz-appearance:textfield;
  }
  .score-input::-webkit-outer-spin-button,
  .score-input::-webkit-inner-spin-button { -webkit-appearance:none; }
  .score-input:focus { background:white; }

  .rb-btn {
    font-family:'Barlow Condensed',sans-serif; font-weight:700;
    letter-spacing:0.06em; text-transform:uppercase;
    border:none; cursor:pointer;
    transition:opacity 0.15s, transform 0.1s;
  }
  .rb-btn:active { transform:scale(0.96); }
  .rb-btn:hover  { opacity:0.85; }

  ::-webkit-scrollbar { width:5px; height:5px; }
  ::-webkit-scrollbar-track { background:var(--rb-offwhite); }
  ::-webkit-scrollbar-thumb { background:var(--rb-navy); }
`;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function initScores(teamNames) {
  const s = {};
  teamNames.forEach(n => { s[n] = {}; GAMES.forEach(g => { s[n][g] = ""; }); });
  return s;
}
function totalFor(scores, team) {
  return Object.values(scores[team] || {}).reduce((a, v) => a + (parseFloat(v) || 0), 0);
}
function persist(data) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch {} }
function hydrate() { try { const r = localStorage.getItem(STORAGE_KEY); return r ? JSON.parse(r) : null; } catch { return null; } }

// ─── Confetti ─────────────────────────────────────────────────────────────────
function Confetti() {
  const ps = Array.from({ length: 65 }, (_, i) => ({
    id:i, left:`${Math.random()*100}%`,
    delay:`${Math.random()*1.5}s`, dur:`${2+Math.random()*2}s`,
    color:["#C8102E","#003DA5","#00A8E0","#FF6900","#FFD700","#001E62"][i%6],
    size:`${7+Math.random()*10}px`, rot:`${Math.random()*360}deg`,
  }));
  return (
    <div style={{position:"fixed",inset:0,pointerEvents:"none",zIndex:999,overflow:"hidden"}}>
      {ps.map(p=>(
        <div key={p.id} style={{
          position:"absolute",top:"-20px",left:p.left,
          width:p.size,height:p.size,background:p.color,
          borderRadius:p.id%3===0?"50%":"1px",
          transform:`rotate(${p.rot})`,
          animation:`confettiFall ${p.dur} ${p.delay} ease-in forwards`,
        }}/>
      ))}
    </div>
  );
}

// ─── Setup Screen ─────────────────────────────────────────────────────────────
function SetupScreen({ onStart }) {
  const [count, setCount] = useState(3);
  const [names, setNames] = useState(["Team Alpha","Team Bravo","Team Charlie"]);

  const updateCount = n => {
    const c = Math.max(2, Math.min(8, n));
    setCount(c);
    setNames(prev => {
      const next = [...prev];
      while (next.length < c) next.push(`Team ${String.fromCharCode(65+next.length)}`);
      return next.slice(0, c);
    });
  };

  return (
    <div style={{minHeight:"100vh",background:"var(--rb-offwhite)",display:"flex",flexDirection:"column"}}>
      <div style={{background:"var(--rb-navy)",padding:"0 20px"}}>
        <div style={{maxWidth:"560px",margin:"0 auto",padding:"24px 0 20px",display:"flex",alignItems:"center",gap:"14px"}}>
          <div style={{width:"46px",height:"46px",background:"var(--rb-red)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"20px",flexShrink:0}}>🎯</div>
          <div>
            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:"11px",letterSpacing:"0.2em",color:"rgba(255,255,255,0.45)",textTransform:"uppercase"}}>Change Management</div>
            <div style={{fontFamily:"'Anton',sans-serif",fontSize:"20px",letterSpacing:"0.05em",color:"white",lineHeight:1.1}}>CHAMPIONSHIP</div>
          </div>
        </div>
      </div>
      <div style={{height:"4px",background:"var(--rb-red)"}}/>

      <div style={{maxWidth:"560px",margin:"0 auto",width:"100%",padding:"32px 20px 48px"}}>
        <div style={{marginBottom:"28px"}} className="fade-up">
          <div style={{fontFamily:"'Anton',sans-serif",fontSize:"clamp(38px,8vw,56px)",lineHeight:1,color:"var(--rb-navy)",letterSpacing:"0.02em"}}>GAME SETUP</div>
          <div style={{width:"44px",height:"4px",background:"var(--rb-red)",marginTop:"10px"}}/>
          <p style={{color:"var(--rb-muted)",fontSize:"15px",marginTop:"10px",fontWeight:500}}>Set up your teams to begin.</p>
        </div>

        {/* Team count */}
        <div style={{background:"white",border:"1px solid var(--rb-border)",padding:"22px",marginBottom:"14px"}} className="fade-up">
          <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:"12px",letterSpacing:"0.14em",textTransform:"uppercase",color:"var(--rb-muted)",marginBottom:"14px"}}>Number of Teams</div>
          <div style={{display:"flex",alignItems:"center",gap:"20px"}}>
            <button onClick={()=>updateCount(count-1)} className="rb-btn" style={{width:"42px",height:"42px",background:"var(--rb-light)",fontSize:"22px",color:"var(--rb-navy)"}}>−</button>
            <span style={{fontFamily:"'Anton',sans-serif",fontSize:"52px",color:"var(--rb-navy)",lineHeight:1,minWidth:"36px",textAlign:"center"}}>{count}</span>
            <button onClick={()=>updateCount(count+1)} className="rb-btn" style={{width:"42px",height:"42px",background:"var(--rb-navy)",fontSize:"22px",color:"white"}}>+</button>
          </div>
        </div>

        {/* Team names */}
        <div style={{background:"white",border:"1px solid var(--rb-border)",padding:"22px",marginBottom:"14px"}} className="fade-up">
          <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:"12px",letterSpacing:"0.14em",textTransform:"uppercase",color:"var(--rb-muted)",marginBottom:"14px"}}>Team Names</div>
          <div style={{display:"flex",flexDirection:"column",gap:"9px"}}>
            {names.map((name,i)=>(
              <div key={i} style={{display:"flex",alignItems:"center",gap:"10px"}}>
                <div style={{width:"30px",height:"30px",background:TEAM_COLORS[i%TEAM_COLORS.length],display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Anton',sans-serif",fontSize:"13px",color:"white",flexShrink:0}}>{i+1}</div>
                <input
                  value={name}
                  onChange={e=>setNames(prev=>prev.map((n,j)=>j===i?e.target.value:n))}
                  placeholder={`Team ${i+1}`}
                  style={{flex:1,padding:"9px 12px",border:"2px solid var(--rb-border)",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:"15px",color:"var(--rb-text)",outline:"none",transition:"border-color 0.15s"}}
                  onFocus={e=>e.target.style.borderColor=TEAM_COLORS[i%TEAM_COLORS.length]}
                  onBlur={e=>e.target.style.borderColor="var(--rb-border)"}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Games preview */}
        <div style={{background:"var(--rb-navy)",padding:"18px 20px",marginBottom:"22px"}} className="fade-up">
          <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:"12px",letterSpacing:"0.14em",textTransform:"uppercase",color:"rgba(255,255,255,0.45)",marginBottom:"10px"}}>Games ({GAMES.length})</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:"5px"}}>
            {GAMES.map((g,i)=>(
              <span key={g} style={{background:"rgba(255,255,255,0.1)",color:"white",border:"1px solid rgba(255,255,255,0.15)",padding:"3px 10px",fontFamily:"'Barlow Condensed',sans-serif",fontSize:"12px",fontWeight:700,letterSpacing:"0.06em",textTransform:"uppercase"}}>
                {i+1}. {g}
              </span>
            ))}
          </div>
        </div>

        <button onClick={()=>{const v=names.map((n,i)=>n.trim()||`Team ${i+1}`);onStart(v);}} className="rb-btn fade-up" style={{width:"100%",padding:"18px",background:"var(--rb-red)",color:"white",fontFamily:"'Anton',sans-serif",fontSize:"22px",letterSpacing:"0.1em"}}>
          START CHAMPIONSHIP →
        </button>
      </div>
    </div>
  );
}

// ─── Score Entry Tab ──────────────────────────────────────────────────────────
function ScoreEntryTab({ teamNames, scores, onChange }) {
  return (
    <div style={{paddingBottom:"60px"}}>
      {GAMES.map((game,gi)=>{
        const rowBg = gi%2===0?"white":"var(--rb-offwhite)";
        return (
          <div key={game} style={{borderBottom:"1px solid var(--rb-border)"}}>
            <div style={{display:"flex",alignItems:"center",gap:"10px",padding:"12px 16px",background:rowBg}}>
              <div style={{width:"26px",height:"26px",background:"var(--rb-navy)",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Anton',sans-serif",fontSize:"11px",color:"white"}}>{gi+1}</div>
              <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:"16px",letterSpacing:"0.06em",color:"var(--rb-navy)",textTransform:"uppercase",flex:1}}>{game}</div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:`repeat(${teamNames.length},1fr)`,background:rowBg,padding:"0 16px 14px",gap:"8px"}}>
              {teamNames.map((team,ti)=>{
                const color = TEAM_COLORS[ti%TEAM_COLORS.length];
                const hasVal = scores[team]?.[game]!=null && scores[team]?.[game]!=="";
                return (
                  <div key={team} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:"5px"}}>
                    <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:"11px",fontWeight:700,letterSpacing:"0.07em",textTransform:"uppercase",color:"var(--rb-muted)",textAlign:"center",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:"90px",borderBottom:`2px solid ${color}`,paddingBottom:"2px",width:"100%"}}>{team}</div>
                    <input
                      type="number"
                      className="score-input"
                      value={scores[team]?.[game]??""}
                      onChange={e=>onChange(team,game,e.target.value)}
                      placeholder="—"
                      style={{borderColor:hasVal?color:undefined}}
                      onFocus={e=>e.target.style.borderColor=color}
                      onBlur={e=>e.target.style.borderColor=hasVal?color:"var(--rb-border)"}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Leaderboard Tab ──────────────────────────────────────────────────────────
function LeaderboardTab({ teamNames, scores }) {
  const ranked = [...teamNames]
    .map(n=>({name:n,total:totalFor(scores,n),color:TEAM_COLORS[teamNames.indexOf(n)%TEAM_COLORS.length]}))
    .sort((a,b)=>b.total-a.total);
  const maxTotal = ranked[0]?.total || 1;
  const MEDALS = ["🥇","🥈","🥉"];
  const completedGames = GAMES.filter(g=>teamNames.some(t=>(scores[t]?.[g]??"")?true:false)).length;

  return (
    <div style={{paddingBottom:"60px"}}>
      {/* Stats strip */}
      <div style={{background:"var(--rb-navy)",padding:"14px 16px",display:"flex",gap:"24px",flexWrap:"wrap"}}>
        {[
          {label:"Leader",value:ranked[0]?.name||"—"},
          {label:"Top Score",value:`${ranked[0]?.total||0} pts`},
          {label:"Games Played",value:`${completedGames} / ${GAMES.length}`},
          {label:"Teams",value:teamNames.length},
        ].map(s=>(
          <div key={s.label}>
            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:"11px",fontWeight:700,letterSpacing:"0.12em",textTransform:"uppercase",color:"rgba(255,255,255,0.4)"}}>{s.label}</div>
            <div style={{fontFamily:"'Anton',sans-serif",fontSize:"22px",color:"white",lineHeight:1.1}}>{s.value}</div>
          </div>
        ))}
      </div>
      <div style={{height:"3px",background:"var(--rb-red)"}}/>

      {/* Rankings */}
      <div style={{padding:"18px 16px 0"}}>
        <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:"12px",letterSpacing:"0.12em",textTransform:"uppercase",color:"var(--rb-muted)",marginBottom:"10px"}}>Overall Rankings</div>
        <div style={{display:"flex",flexDirection:"column",gap:"7px"}}>
          {ranked.map((t,i)=>{
            const pct = maxTotal>0?(t.total/maxTotal)*100:0;
            return (
              <div key={t.name} className="row-in" style={{animationDelay:`${i*0.07}s`,background:"white",border:"1px solid var(--rb-border)",padding:"13px 14px"}}>
                <div style={{display:"flex",alignItems:"center",gap:"10px",marginBottom:"8px"}}>
                  <div style={{fontSize:"18px",width:"26px"}}>{MEDALS[i]||`#${i+1}`}</div>
                  <div style={{flex:1,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:"16px",letterSpacing:"0.04em",color:"var(--rb-navy)",textTransform:"uppercase"}}>{t.name}</div>
                  <div style={{fontFamily:"'Anton',sans-serif",fontSize:"26px",color:t.color,lineHeight:1}}>
                    {t.total}<span style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:"12px",color:"var(--rb-muted)",marginLeft:"3px"}}>pts</span>
                  </div>
                </div>
                <div style={{height:"5px",background:"var(--rb-light)"}}>
                  <div style={{height:"100%",width:`${pct}%`,background:t.color,animation:`barGrow 0.8s ${i*0.1}s ease both`}}/>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Game breakdown table */}
      <div style={{padding:"22px 16px 0"}}>
        <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:"12px",letterSpacing:"0.12em",textTransform:"uppercase",color:"var(--rb-muted)",marginBottom:"10px"}}>Game-by-Game Breakdown</div>
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",minWidth:"360px"}}>
            <thead>
              <tr style={{background:"var(--rb-navy)"}}>
                <th style={{padding:"10px 12px",fontFamily:"'Barlow Condensed',sans-serif",fontSize:"11px",fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",color:"rgba(255,255,255,0.5)",textAlign:"left",whiteSpace:"nowrap"}}>Game</th>
                {teamNames.map((t,ti)=>(
                  <th key={t} style={{padding:"10px 10px",fontFamily:"'Barlow Condensed',sans-serif",fontSize:"11px",fontWeight:700,letterSpacing:"0.07em",textTransform:"uppercase",color:"white",textAlign:"center",borderLeft:`3px solid ${TEAM_COLORS[ti%TEAM_COLORS.length]}`}}>{t}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {GAMES.map((game,gi)=>{
                const rowVals = teamNames.map(t=>parseFloat(scores[t]?.[game])||0);
                const rowMax = Math.max(...rowVals);
                return (
                  <tr key={game} style={{background:gi%2===0?"white":"var(--rb-offwhite)"}}>
                    <td style={{padding:"9px 12px",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:"13px",color:"var(--rb-navy)",textTransform:"uppercase",whiteSpace:"nowrap"}}>
                      <span style={{color:"var(--rb-muted)",fontSize:"11px",marginRight:"5px"}}>{gi+1}</span>{game}
                    </td>
                    {teamNames.map((t,ti)=>{
                      const val=parseFloat(scores[t]?.[game])||0;
                      const top=val>0&&val===rowMax;
                      return (
                        <td key={t} style={{padding:"9px 10px",textAlign:"center",fontFamily:"'Anton',sans-serif",fontSize:"17px",color:top?TEAM_COLORS[ti%TEAM_COLORS.length]:val>0?"var(--rb-text)":"var(--rb-border)",borderLeft:`3px solid ${TEAM_COLORS[ti%TEAM_COLORS.length]}22`,background:top?`${TEAM_COLORS[ti%TEAM_COLORS.length]}12`:"transparent"}}>
                          {val>0?val:"—"}{top&&<span style={{fontSize:"9px",marginLeft:"2px"}}>▲</span>}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
              <tr style={{background:"var(--rb-navy)"}}>
                <td style={{padding:"11px 12px",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:"12px",letterSpacing:"0.1em",textTransform:"uppercase",color:"rgba(255,255,255,0.55)"}}>TOTAL</td>
                {teamNames.map((t,ti)=>(
                  <td key={t} style={{padding:"11px 10px",textAlign:"center",fontFamily:"'Anton',sans-serif",fontSize:"20px",color:TEAM_COLORS[ti%TEAM_COLORS.length],borderLeft:`3px solid ${TEAM_COLORS[ti%TEAM_COLORS.length]}`}}>{totalFor(scores,t)}</td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Results Screen ───────────────────────────────────────────────────────────
function ResultsScreen({ teamNames, scores, onPlayAgain, onNewGame }) {
  const ranked = [...teamNames]
    .map(n=>({name:n,total:totalFor(scores,n),color:TEAM_COLORS[teamNames.indexOf(n)%TEAM_COLORS.length]}))
    .sort((a,b)=>b.total-a.total);
  const maxTotal = ranked[0]?.total||1;
  const MEDALS = ["🥇","🥈","🥉"];
  const podiumOrder = [ranked[1],ranked[0],ranked[2]].filter(Boolean);
  const podiumH = ["110px","160px","76px"];

  return (
    <div style={{minHeight:"100vh",background:"var(--rb-offwhite)"}} className="fade-up">
      <Confetti/>
      <div style={{background:"var(--rb-navy)",padding:"0 20px"}}>
        <div style={{maxWidth:"720px",margin:"0 auto",padding:"14px 0",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{fontFamily:"'Anton',sans-serif",fontSize:"13px",letterSpacing:"0.12em",color:"rgba(255,255,255,0.4)",textTransform:"uppercase"}}>Change Management Championship</div>
          <button onClick={onNewGame} className="rb-btn" style={{padding:"7px 16px",background:"rgba(255,255,255,0.08)",color:"rgba(255,255,255,0.65)",fontSize:"12px",border:"1px solid rgba(255,255,255,0.15)"}}>✕ New Game</button>
        </div>
      </div>
      <div style={{height:"4px",background:"var(--rb-red)"}}/>

      <div style={{maxWidth:"720px",margin:"0 auto",padding:"28px 20px 60px"}}>
        {/* Hero */}
        <div style={{textAlign:"center",marginBottom:"36px"}} className="fade-up">
          <div className="trophy-drop" style={{fontSize:"60px",lineHeight:1,display:"inline-block"}}>🏆</div>
          <div style={{fontFamily:"'Anton',sans-serif",fontSize:"clamp(40px,9vw,68px)",letterSpacing:"0.04em",lineHeight:1,marginTop:"10px",background:"linear-gradient(90deg,#C8102E,#003DA5,#00A8E0,#C8102E)",backgroundSize:"300% auto",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",animation:"shimmer 3s linear infinite"}}>FINAL RESULTS</div>
          <div style={{color:"var(--rb-muted)",fontSize:"15px",fontWeight:600,marginTop:"6px"}}>{ranked[0]?.name} wins the Championship!</div>
        </div>

        {/* Podium */}
        {ranked.length>=2&&(
          <div style={{display:"flex",alignItems:"flex-end",justifyContent:"center",gap:"3px",marginBottom:"36px",height:"260px"}}>
            {podiumOrder.map((team,di)=>{
              const ar=ranked.indexOf(team);
              const isW=ar===0;
              return (
                <div key={team.name} style={{display:"flex",flexDirection:"column",alignItems:"center",flex:1,maxWidth:"180px"}}>
                  <div style={{textAlign:"center",marginBottom:"8px",animation:`fadeUp 0.5s ${di*0.15}s both`}}>
                    <div style={{fontSize:isW?"34px":"22px"}}>{MEDALS[ar]||`#${ar+1}`}</div>
                    <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:isW?"15px":"12px",color:"var(--rb-navy)",textTransform:"uppercase",letterSpacing:"0.04em",marginTop:"3px",maxWidth:"140px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{team.name}</div>
                    <div style={{fontFamily:"'Anton',sans-serif",fontSize:isW?"30px":"22px",color:team.color,lineHeight:1}}>{team.total}</div>
                  </div>
                  <div className="podium-rise" style={{width:"100%",height:podiumH[di],background:team.color,display:"flex",alignItems:"center",justifyContent:"center",animationDelay:`${di*0.12}s`}}>
                    <span style={{fontFamily:"'Anton',sans-serif",fontSize:"20px",color:"rgba(255,255,255,0.2)"}}>#{ar+1}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Full standings */}
        <div style={{border:"1px solid var(--rb-border)",background:"white",marginBottom:"18px"}}>
          <div style={{background:"var(--rb-navy)",padding:"11px 14px",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:"12px",letterSpacing:"0.12em",textTransform:"uppercase",color:"rgba(255,255,255,0.55)"}}>Full Standings</div>
          {ranked.map((t,i)=>{
            const pct=(t.total/maxTotal)*100;
            return (
              <div key={t.name} className="row-in" style={{animationDelay:`${i*0.08+0.3}s`,padding:"13px 14px",borderBottom:"1px solid var(--rb-border)"}}>
                <div style={{display:"flex",alignItems:"center",gap:"10px",marginBottom:"7px"}}>
                  <span style={{fontSize:"17px",width:"26px"}}>{MEDALS[i]||`#${i+1}`}</span>
                  <span style={{flex:1,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:"16px",textTransform:"uppercase",color:"var(--rb-navy)",letterSpacing:"0.04em"}}>{t.name}</span>
                  <span style={{fontFamily:"'Anton',sans-serif",fontSize:"24px",color:t.color,lineHeight:1}}>{t.total}<span style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:"12px",color:"var(--rb-muted)",marginLeft:"3px"}}>pts</span></span>
                </div>
                <div style={{height:"5px",background:"var(--rb-light)"}}>
                  <div style={{height:"100%",width:`${pct}%`,background:t.color,animation:`barGrow 0.7s ${i*0.08+0.4}s ease both`}}/>
                </div>
              </div>
            );
          })}
        </div>

        {/* Stats */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px",marginBottom:"24px"}}>
          {[
            {label:"🏆 Champion",value:ranked[0]?.name},
            {label:"📊 Winning Score",value:`${ranked[0]?.total??0} pts`},
            {label:"📉 Last Place",value:ranked[ranked.length-1]?.name},
            {label:"🎯 Total Points",value:`${ranked.reduce((s,t)=>s+t.total,0)} pts`},
          ].map((s,i)=>(
            <div key={i} className="row-in" style={{animationDelay:`${i*0.08+0.5}s`,background:"white",border:"1px solid var(--rb-border)",padding:"14px"}}>
              <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:"11px",fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase",color:"var(--rb-muted)",marginBottom:"3px"}}>{s.label}</div>
              <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:"16px",color:"var(--rb-navy)",wordBreak:"break-word"}}>{s.value}</div>
            </div>
          ))}
        </div>

        <div style={{display:"flex",gap:"10px"}}>
          <button onClick={onPlayAgain} className="rb-btn" style={{flex:1,padding:"17px",background:"var(--rb-navy)",color:"white",fontFamily:"'Anton',sans-serif",fontSize:"19px",letterSpacing:"0.08em"}}>↺ PLAY AGAIN</button>
          <button onClick={onNewGame} className="rb-btn" style={{flex:1,padding:"17px",background:"var(--rb-red)",color:"white",fontFamily:"'Anton',sans-serif",fontSize:"19px",letterSpacing:"0.08em"}}>NEW GAME →</button>
        </div>
      </div>
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [screen, setScreen] = useState("setup");
  const [teamNames, setTeamNames] = useState([]);
  const [scores, setScores] = useState({});
  const [activeTab, setActiveTab] = useState("entry");

  // Restore on mount
  useEffect(() => {
    const saved = hydrate();
    if (saved?.teamNames?.length && saved.screen === "game") {
      setTeamNames(saved.teamNames);
      setScores(saved.scores || initScores(saved.teamNames));
      setScreen("game");
      setActiveTab(saved.activeTab || "entry");
    }
  }, []);

  // Persist on change
  useEffect(() => {
    if (screen === "game" && teamNames.length > 0) {
      persist({ teamNames, scores, screen: "game", activeTab });
    }
  }, [teamNames, scores, screen, activeTab]);

  const handleStart = names => {
    const s = initScores(names);
    setTeamNames(names); setScores(s); setScreen("game"); setActiveTab("entry");
    persist({ teamNames: names, scores: s, screen: "game", activeTab: "entry" });
  };

  const handleScoreChange = useCallback((team, game, value) => {
    setScores(prev => ({ ...prev, [team]: { ...prev[team], [game]: value } }));
  }, []);

  const handleResetScores = () => {
    if (!window.confirm("Reset all scores? This cannot be undone.")) return;
    const fresh = initScores(teamNames);
    setScores(fresh);
    persist({ teamNames, scores: fresh, screen: "game", activeTab });
  };

  const handlePlayAgain = () => {
    const fresh = initScores(teamNames);
    setScores(fresh); setScreen("game"); setActiveTab("entry");
    persist({ teamNames, scores: fresh, screen: "game", activeTab: "entry" });
  };

  const handleNewGame = () => {
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
    setTeamNames([]); setScores({}); setScreen("setup");
  };

  if (screen === "setup") return <><style>{CSS}</style><SetupScreen onStart={handleStart}/></>;
  if (screen === "results") return <><style>{CSS}</style><ResultsScreen teamNames={teamNames} scores={scores} onPlayAgain={handlePlayAgain} onNewGame={handleNewGame}/></>;

  return (
    <>
      <style>{CSS}</style>
      <div style={{minHeight:"100vh",background:"var(--rb-offwhite)",display:"flex",flexDirection:"column"}}>

        {/* Header */}
        <div style={{background:"var(--rb-navy)",position:"sticky",top:0,zIndex:100}}>
          <div style={{maxWidth:"760px",margin:"0 auto",padding:"11px 16px",display:"flex",alignItems:"center",gap:"10px"}}>
            <div style={{width:"36px",height:"36px",background:"var(--rb-red)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"17px",flexShrink:0}}>🎯</div>
            <div style={{flex:1,fontFamily:"'Anton',sans-serif",fontSize:"13px",letterSpacing:"0.05em",color:"white",lineHeight:1.15}}>THE CHANGE MANAGEMENT CHAMPIONSHIP</div>
            <button onClick={handleResetScores} className="rb-btn" style={{padding:"6px 12px",background:"rgba(255,255,255,0.07)",color:"rgba(255,255,255,0.55)",fontSize:"11px",border:"1px solid rgba(255,255,255,0.12)",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,letterSpacing:"0.06em",textTransform:"uppercase",whiteSpace:"nowrap"}}>↺ Reset</button>
            <button onClick={()=>setScreen("results")} className="rb-btn" style={{padding:"6px 12px",background:"var(--rb-red)",color:"white",fontSize:"11px",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,letterSpacing:"0.06em",textTransform:"uppercase",whiteSpace:"nowrap"}}>🏁 End Game</button>
          </div>
          <div style={{height:"3px",background:"var(--rb-red)"}}/>
          {/* Tabs */}
          <div style={{maxWidth:"760px",margin:"0 auto"}}>
            <div className="tab-bar">
              <button className={`tab-btn${activeTab==="entry"?" active":""}`} onClick={()=>setActiveTab("entry")}>✏️ Score Entry</button>
              <button className={`tab-btn${activeTab==="board"?" active":""}`} onClick={()=>setActiveTab("board")}>📊 Leaderboard</button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div style={{maxWidth:"760px",margin:"0 auto",width:"100%",flex:1}}>
          {activeTab==="entry"
            ? <ScoreEntryTab teamNames={teamNames} scores={scores} onChange={handleScoreChange}/>
            : <LeaderboardTab teamNames={teamNames} scores={scores}/>
          }
        </div>
      </div>
    </>
  );
}
