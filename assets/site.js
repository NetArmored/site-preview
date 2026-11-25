/* mockup v2: resolve root-absolute links ("/contact/") relative to this folder so the mockup works from disk or any subfolder */
(function(){var cs=document.currentScript;var ROOT=cs?cs.src.replace(/assets\/site\.js.*$/,''):'';
document.addEventListener('click',function(e){var a=e.target.closest&&e.target.closest('a[href^="/"]');if(!a)return;var h=a.getAttribute('href');if(h.indexOf('//')===0||h.indexOf('/api/')===0)return;
var q='';var i=h.search(/[?#]/);if(i>-1){q=h.slice(i);h=h.slice(0,i);}if(/\/$/.test(h))h+='index.html';e.preventDefault();location.href=ROOT+h.slice(1)+q;},true);})();
/* NetArmored concept preview — shared interactions. No network calls, no storage, no analytics. */
(function(){
'use strict';
var d=document, de=d.documentElement;
de.classList.remove('no-js');
var RM=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
function $(s,c){return (c||d).querySelector(s)}
function $$(s,c){return Array.prototype.slice.call((c||d).querySelectorAll(s))}

/* preview bar */
var pb=$('#preview-close'); if(pb) pb.addEventListener('click',function(){var b=$('#preview-bar'); if(b) b.remove();});

/* header */
var hdr=$('.hdr'); function onS(){ if(hdr) hdr.classList.toggle('scrolled', window.scrollY>8); }
window.addEventListener('scroll',onS,{passive:true}); onS();

/* mobile menu */
var mb=$('.menu-btn');
if(mb){ mb.addEventListener('click',function(){ var o=d.body.classList.toggle('menu-open'); mb.setAttribute('aria-expanded',o); mb.setAttribute('aria-label',o?'Close menu':'Open menu'); });
  $$('.mnav a').forEach(function(a){a.addEventListener('click',function(){d.body.classList.remove('menu-open');mb.setAttribute('aria-expanded','false');});});
  d.addEventListener('keydown',function(e){ if(e.key==='Escape' && d.body.classList.contains('menu-open')){ d.body.classList.remove('menu-open'); mb.setAttribute('aria-expanded','false'); mb.focus(); }});
}
/* dropdowns: click + hover + keyboard */
$$('.nav li.has-dd').forEach(function(li){
  var b=$('button.nl',li);
  function set(o){ li.classList.toggle('open',o); b.setAttribute('aria-expanded',o); }
  b.addEventListener('click',function(e){ e.stopPropagation(); var o=!li.classList.contains('open'); $$('.nav li.has-dd').forEach(function(x){ if(x!==li){x.classList.remove('open'); $('button.nl',x).setAttribute('aria-expanded','false');} }); set(o); });
  li.addEventListener('mouseenter',function(){ if(window.matchMedia('(hover:hover)').matches) set(true); });
  li.addEventListener('mouseleave',function(){ if(window.matchMedia('(hover:hover)').matches) set(false); });
  li.addEventListener('keydown',function(e){ if(e.key==='Escape'){ set(false); b.focus(); } });
  li.addEventListener('focusout',function(e){ if(!li.contains(e.relatedTarget)) set(false); });
});
d.addEventListener('click',function(){ $$('.nav li.has-dd.open').forEach(function(x){x.classList.remove('open'); $('button.nl',x).setAttribute('aria-expanded','false');}); });

/* reveal */
if('IntersectionObserver' in window && !RM){
  var io=new IntersectionObserver(function(es){ es.forEach(function(e){ if(e.isIntersecting){ e.target.classList.add('in'); io.unobserve(e.target);} }); },{rootMargin:'0px 0px -8% 0px'});
  $$('.rv').forEach(function(el){io.observe(el);});
} else $$('.rv').forEach(function(el){el.classList.add('in');});

/* hero video: poster first, video after load; skipped for reduced motion / save-data */
var hv=$('#hero-video');
if(hv){
  var conn=navigator.connection||{}; var skip=RM||conn.saveData||/2g/.test(conn.effectiveType||'');
  var tgl=$('#vid-toggle');
  if(skip){ if(tgl) tgl.hidden=true; }
  else window.addEventListener('load',function(){ setTimeout(function(){
    var small=window.matchMedia('(max-width:760px)').matches;
    hv.src=hv.getAttribute(small?'data-src-sm':'data-src'); hv.muted=true; var p=hv.play(); if(p&&p.catch) p.catch(function(){});
    if('IntersectionObserver' in window){ new IntersectionObserver(function(es){ es.forEach(function(e){ if(hv.dataset.user==='paused')return; if(e.isIntersecting) hv.play().catch(function(){}); else hv.pause(); }); }).observe(hv); }
    d.addEventListener('visibilitychange',function(){ if(d.hidden) hv.pause(); else if(hv.dataset.user!=='paused') hv.play().catch(function(){}); });
  },300); });
  var snd=$('#snd-toggle');
  if(snd){ if(skip) snd.hidden=true; snd.addEventListener('click',function(){ if(!hv.src) hv.src=hv.getAttribute('data-src'); hv.muted=!hv.muted; if(!hv.muted){ hv.volume=1; hv.play().catch(function(){}); } snd.textContent=hv.muted?'Sound on':'Sound off'; snd.setAttribute('aria-pressed', hv.muted?'false':'true'); }); }
  if(tgl) tgl.addEventListener('click',function(){ if(hv.paused){ hv.dataset.user=''; hv.play().catch(function(){}); tgl.textContent='Pause video'; tgl.setAttribute('aria-pressed','false'); } else { hv.dataset.user='paused'; hv.pause(); tgl.textContent='Play video'; tgl.setAttribute('aria-pressed','true'); } });
}

/* ---------- Transformation canvas: disconnected systems -> connected, governed operation ---------- */
function transformViz(cv){
  var ctx=cv.getContext('2d'), W=0,H=0,DPR=Math.min(window.devicePixelRatio||1,2);
  var labels=['POS','Email','Spreadsheets','Scheduling','Accounting','CRM','Inventory','Phones','Website','Reports'];
  var nodes=labels.map(function(l,i){ return {l:l, sx:Math.random(), sy:Math.random(), a:(i/labels.length)*Math.PI*2-Math.PI/2}; });
  var dust=[]; for(var i=0;i<46;i++) dust.push({x:Math.random(),y:Math.random(),v:.2+Math.random()*.6,p:Math.random()*6.28});
  var t0=performance.now(), playing=!RM, prog=RM?1:0, raf=null, last=t0, cycle=0;
  var stateEl=$('.viz-state', cv.parentNode);
  function size(){ var r=cv.getBoundingClientRect(); W=r.width; H=r.height; cv.width=W*DPR; cv.height=H*DPR; ctx.setTransform(DPR,0,0,DPR,0,0); }
  function ease(x){ return x<.5?4*x*x*x:1-Math.pow(-2*x+2,3)/2; }
  function shield(ctx,cx,cy,s,alpha){
    ctx.save(); ctx.translate(cx,cy); ctx.beginPath();
    ctx.moveTo(0,-s); ctx.lineTo(s*.82,-s*.62); ctx.lineTo(s*.82,s*.05); ctx.bezierCurveTo(s*.82,s*.6,s*.4,s*.92,0,s*1.08); ctx.bezierCurveTo(-s*.4,s*.92,-s*.82,s*.6,-s*.82,s*.05); ctx.lineTo(-s*.82,-s*.62); ctx.closePath();
    var g=ctx.createLinearGradient(-s,-s,s,s); g.addColorStop(0,'rgba(55,125,255,'+alpha+')'); g.addColorStop(1,'rgba(45,212,191,'+alpha+')');
    ctx.strokeStyle=g; ctx.lineWidth=1.6; ctx.stroke(); ctx.fillStyle='rgba(55,125,255,'+(alpha*.08)+')'; ctx.fill(); ctx.restore();
  }
  function draw(now){
    var dt=Math.min(64,now-last); last=now;
    if(playing){ prog=Math.min(1,prog+dt/5200); if(prog>=1){ cycle+=dt; if(cycle>5200){ cycle=0; prog=0; nodes.forEach(function(n){n.sx=Math.random();n.sy=Math.random();}); } } }
    var e=ease(prog), cx=W/2, cy=H*.53, R=Math.min(W,H)*.36, time=now/1000;
    ctx.clearRect(0,0,W,H);
    // grid
    ctx.strokeStyle='rgba(200,213,228,0.045)'; ctx.lineWidth=1; var gs=Math.max(28,W/18);
    for(var x=(W%gs)/2;x<W;x+=gs){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();}
    for(var y=(H%gs)/2;y<H;y+=gs){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}
    dust.forEach(function(p){ var yy=((p.y*H - (RM?0:time*p.v*8))%H+H)%H; ctx.fillStyle='rgba(141,181,255,'+(0.12+0.1*Math.sin(p.p+time))+')'; ctx.fillRect(p.x*W,yy,1.4,1.4); });
    // positions
    var pos=nodes.map(function(n){ var scx=W*(.12+n.sx*.76), scy=H*(.16+n.sy*.7); var tx=cx+Math.cos(n.a)*R, ty=cy+Math.sin(n.a)*R*.92; var wob=RM?0:Math.sin(time*.8+n.a*3)*2; return {x:scx+(tx-scx)*e, y:scy+(ty-scy)*e+wob}; });
    // broken silo links (before)
    if(e<.98){ ctx.setLineDash([3,6]); ctx.strokeStyle='rgba(244,160,143,'+(.35*(1-e))+')';
      for(var i=0;i<pos.length;i+=2){ var a=pos[i], b=pos[(i+3)%pos.length]; ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(a.x+(b.x-a.x)*.42,a.y+(b.y-a.y)*.42); ctx.stroke(); }
      ctx.setLineDash([]); }
    // hub links + ring
    var la=Math.max(0,(e-.35)/.65);
    if(la>0){
      pos.forEach(function(p,i){ var g=ctx.createLinearGradient(cx,cy,p.x,p.y); g.addColorStop(0,'rgba(45,212,191,'+(.55*la)+')'); g.addColorStop(1,'rgba(55,125,255,'+(.45*la)+')'); ctx.strokeStyle=g; ctx.lineWidth=1.2; ctx.beginPath(); ctx.moveTo(cx,cy); ctx.lineTo(p.x,p.y); ctx.stroke();
        var q=pos[(i+1)%pos.length]; ctx.strokeStyle='rgba(55,125,255,'+(.22*la)+')'; ctx.beginPath(); ctx.moveTo(p.x,p.y); ctx.lineTo(q.x,q.y); ctx.stroke();
        if(!RM){ var k=((time*.45+i*.137)%1); var px=p.x+(cx-p.x)*k, py=p.y+(cy-p.y)*k; ctx.fillStyle='rgba(45,212,191,'+(.9*la)+')'; ctx.beginPath(); ctx.arc(px,py,2,0,6.28); ctx.fill(); }
      });
    }
    // core shield
    shield(ctx,cx,cy-4,R*.3*(.6+.4*e),.25+.75*la);
    if(la>.2){ ctx.fillStyle='rgba(248,250,252,'+la+')'; ctx.font='600 '+Math.max(10,R*.075)+'px Sora, sans-serif'; ctx.textAlign='center'; ctx.fillText('Secure AI layer',cx,cy+2); ctx.font='500 '+Math.max(8,R*.05)+'px "JB Mono", monospace'; ctx.fillStyle='rgba(45,212,191,'+la+')'; ctx.fillText('HUMAN APPROVAL · ACCESS CONTROL',cx,cy+R*.1+4); }
    // nodes
    ctx.textAlign='center';
    pos.forEach(function(p,i){ var on=la>.1; var w=Math.max(54,nodes[i].l.length*6.4+18), h=24;
      ctx.fillStyle=on?'rgba(17,29,46,0.95)':'rgba(22,30,44,0.92)'; ctx.strokeStyle=on?'rgba(55,125,255,'+(.4+.5*la)+')':'rgba(200,213,228,0.25)'; ctx.lineWidth=1;
      rr(ctx,p.x-w/2,p.y-h/2,w,h,8); ctx.fill(); ctx.stroke();
      ctx.fillStyle=on?'#F8FAFC':'#93A4BB'; ctx.font='500 11px Inter, sans-serif'; ctx.fillText(nodes[i].l,p.x,p.y+4);
    });
    if(stateEl){ stateEl.innerHTML = e<.35?'State: <i>disconnected tools</i> · re-keying, missed handoffs': e<.98?'State: <i>connecting</i> · integrations + governance':'State: <i>connected operation</i> · secured, human-approved'; }
    if(playing||RM===false) raf=requestAnimationFrame(draw);
  }
  function rr(c,x,y,w,h,r){c.beginPath();c.moveTo(x+r,y);c.arcTo(x+w,y,x+w,y+h,r);c.arcTo(x+w,y+h,x,y+h,r);c.arcTo(x,y+h,x,y,r);c.arcTo(x,y,x+w,y,r);c.closePath();}
  size(); window.addEventListener('resize',size);
  if(RM){ draw(performance.now()); } else {
    var vis=true; if('IntersectionObserver' in window) new IntersectionObserver(function(es){ vis=es[0].isIntersecting; if(vis&&!raf){ last=performance.now(); raf=requestAnimationFrame(draw);} else if(!vis&&raf){ cancelAnimationFrame(raf); raf=null; } }).observe(cv);
    raf=requestAnimationFrame(draw);
  }
  var pbtn=$('[data-viz=pause]',cv.parentNode), rbtn=$('[data-viz=replay]',cv.parentNode), bbtn=$('[data-viz=before]',cv.parentNode);
  if(pbtn) pbtn.addEventListener('click',function(){ playing=!playing; pbtn.textContent=playing?'Pause':'Play'; pbtn.setAttribute('aria-pressed',!playing); if(RM) draw(performance.now()); });
  if(rbtn) rbtn.addEventListener('click',function(){ prog=0; cycle=0; if(RM){ prog=1; } playing=true; if(pbtn){pbtn.textContent='Pause';} if(RM) draw(performance.now()); });
  if(bbtn) bbtn.addEventListener('click',function(){ prog=0; playing=false; if(pbtn){pbtn.textContent='Play';} draw(performance.now()); });
}
$$('canvas.tviz').forEach(transformViz);

/* ambient network canvas (closing CTA) */
$$('canvas.netbg').forEach(function(cv){
  var ctx=cv.getContext('2d'),W,H,DPR=Math.min(window.devicePixelRatio||1,2),pts=[],raf=null;
  function size(){var r=cv.getBoundingClientRect();W=r.width;H=r.height;cv.width=W*DPR;cv.height=H*DPR;ctx.setTransform(DPR,0,0,DPR,0,0);pts=[];var n=Math.round(W*H/22000);for(var i=0;i<n;i++)pts.push({x:Math.random()*W,y:Math.random()*H,vx:(Math.random()-.5)*.25,vy:(Math.random()-.5)*.25});}
  function step(){ctx.clearRect(0,0,W,H);for(var i=0;i<pts.length;i++){var p=pts[i];if(!RM){p.x+=p.vx;p.y+=p.vy;if(p.x<0||p.x>W)p.vx*=-1;if(p.y<0||p.y>H)p.vy*=-1;}
    for(var j=i+1;j<pts.length;j++){var q=pts[j],dx=p.x-q.x,dy=p.y-q.y,dd=dx*dx+dy*dy;if(dd<13000){ctx.strokeStyle='rgba(55,125,255,'+(.28*(1-dd/13000))+')';ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(q.x,q.y);ctx.stroke();}}
    ctx.fillStyle=i%7===0?'rgba(45,212,191,.8)':'rgba(141,181,255,.55)';ctx.beginPath();ctx.arc(p.x,p.y,i%7===0?2:1.3,0,6.28);ctx.fill();}
    if(!RM) raf=requestAnimationFrame(step);}
  size();window.addEventListener('resize',function(){size();if(RM)step();});
  if(RM) step(); else if('IntersectionObserver' in window) new IntersectionObserver(function(es){if(es[0].isIntersecting){if(!raf)raf=requestAnimationFrame(step);}else if(raf){cancelAnimationFrame(raf);raf=null;}}).observe(cv); else step();
});

/* problem cards */
$$('.pcard').forEach(function(c){ c.addEventListener('click',function(){ var o=c.getAttribute('aria-expanded')==='true'; c.setAttribute('aria-expanded',!o); var m=$('.more',c); if(m) m.textContent=o?'See a practical example +':'Close −'; }); });

/* tabs (stages) */
$$('[data-tabs]').forEach(function(root){
  var tabs=$$('[role=tab]',root);
  function sel(i){ tabs.forEach(function(t,k){ var on=k===i; t.setAttribute('aria-selected',on); t.tabIndex=on?0:-1; var p=d.getElementById(t.getAttribute('aria-controls')); if(p){p.classList.toggle('on',on); p.hidden=!on;} });
    $$('.rung',root).forEach(function(r,k){ r.classList.toggle('on',k<=i); var b=$('.bar i',r); if(b) b.style.width=(k<=i?(k===i?100:100):0)+'%'; }); }
  tabs.forEach(function(t,i){ t.addEventListener('click',function(){sel(i);}); t.addEventListener('keydown',function(e){ var k=e.key==='ArrowRight'?1:e.key==='ArrowLeft'?-1:0; if(k){ e.preventDefault(); var n=(i+k+tabs.length)%tabs.length; tabs[n].focus(); sel(n);} }); });
  sel(0);
});

/* before/after flow */
$$('[data-flow]').forEach(function(root){
  var bs=$$('.flow-toggle button',root);
  bs.forEach(function(b){ b.addEventListener('click',function(){ bs.forEach(function(x){x.setAttribute('aria-pressed',x===b);}); var w=b.dataset.show; $$('[data-state]',root).forEach(function(p){ p.hidden=p.dataset.state!==w; }); }); });
});

/* simple calc (hospitality demo) */
$$('[data-mini]').forEach(function(root){
  var inq=$('[name=inq]',root), min=$('[name=min]',root), out=$('[data-out]',root), yr=$('[data-yr]',root);
  function upd(){ var h=(+inq.value||0)*(+min.value||0)/60; out.textContent=(Math.round(h*10)/10).toLocaleString(); yr.textContent=Math.round(h*50).toLocaleString();
    $$('output[for]',root).forEach(function(o){ var el=d.getElementById(o.getAttribute('for')); if(el) o.textContent=el.value; }); }
  [inq,min].forEach(function(i){ i.addEventListener('input',upd); }); upd();
});

/* scroll-spy TOC */
var toc=$('.toc');
if(toc && 'IntersectionObserver' in window){ var links=$$('a',toc); var spy=new IntersectionObserver(function(es){ es.forEach(function(e){ if(e.isIntersecting){ links.forEach(function(l){ l.classList.toggle('on', l.getAttribute('href')==='#'+e.target.id); }); } }); },{rootMargin:'-30% 0px -60% 0px'}); links.forEach(function(l){ var t=d.getElementById(l.getAttribute('href').slice(1)); if(t) spy.observe(t); }); }

/* ---------- Contact form: validate, then POST to /api/contact ---------- */
$$('form[data-contact-form], form[data-demo]').forEach(function(f){
  var src=$('[name=lead_source]',f); if(src){ var q=new URLSearchParams(location.search).get('source'); if(q) src.value=q.replace(/[^a-z0-9-]/gi,'').slice(0,40); var sv=$('[data-source-view]',f); if(sv) sv.textContent=src.value; }
  if(f.hasAttribute('data-contact-form')){
    var qp=new URLSearchParams(location.search);
    var labels={hospitality:'Hospitality, Restaurants, Bars & Entertainment',restaurant:'Restaurants (Without Gaming)',retail:'Retail & Convenience Stores',professional:'Professional Services',logistics:'Logistics & Transportation',home:'Home Services & Field Operations',healthcare:'Healthcare Administration',general:'General Small Business Operations'};
    function fillNamed(field, value, keepBreaks){
      if(value==null || !String(value).trim()) return false;
      var el=f.querySelector('[name="'+field+'"]');
      if(!el || el.type==='checkbox' || el.type==='radio' || el.type==='hidden') return false;
      var v=String(value).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,'');
      if(!keepBreaks) v=v.replace(/[\r\n]+/g,' ');
      v=v.trim();
      if(el.maxLength>0 && v.length>el.maxLength) v=v.slice(0, el.maxLength);
      if(el.tagName==='SELECT'){
        var want=labels[v]||v, found=false;
        for(var i=0;i<el.options.length;i++){ if(el.options[i].value===want || el.options[i].text===want){ el.selectedIndex=i; found=true; break; } }
        return found;
      }
      el.value=v; return true;
    }
    var touched=false;
    touched=fillNamed('name', qp.get('name'))||touched;
    touched=fillNamed('email', qp.get('email'))||touched;
    touched=fillNamed('biz', qp.get('business'))||touched;
    touched=fillNamed('phone', qp.get('phone'))||touched;
    touched=fillNamed('industry', qp.get('industry'))||touched;
    touched=fillNamed('challenges', qp.get('summary'), true)||touched;
    if(touched){
      var consentBox=f.querySelector('[name=consent]');
      if(consentBox) consentBox.checked=false;
      var note=d.createElement('p');
      note.className='small muted';
      note.style.marginTop='10px';
      note.textContent='Details from your AI Opportunity Scan are filled in below. The consent box is left unticked.';
      var anchor=f.querySelector('[data-source-view]');
      if(anchor && anchor.parentNode && anchor.parentNode.parentNode) anchor.parentNode.parentNode.insertBefore(note, anchor.parentNode);
    }
  }
  f.addEventListener('submit',function(e){
    e.preventDefault(); var ok=true, first=null;
    $$('[data-req]',f).forEach(function(el){ var v=el.type==='checkbox'?el.checked:(el.value||'').trim(); var bad=!v; if(!bad && el.type==='email') bad=!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(el.value.trim());
      el.setAttribute('aria-invalid',bad); var er=d.getElementById(el.getAttribute('aria-describedby')||''); if(er && er.classList.contains('err')) er.classList.toggle('on',bad); if(bad){ ok=false; if(!first) first=el; } });
    if(!ok){ if(first) first.focus(); return; }
    var btn=$('button[type=submit]',f);
    if(btn) btn.disabled=true;
    var body=new FormData(f);
    fetch(f.getAttribute('action')||'/api/contact',{method:'POST',body:body,credentials:'same-origin',headers:{'Accept':'application/json'}})
      .then(function(r){ return r.json().then(function(j){ return {ok:r.ok, status:r.status, json:j}; }).catch(function(){ return {ok:r.ok, status:r.status, json:{}}; }); })
      .then(function(res){
        var kind='error';
        if(res.json && res.json.code==='mailer_not_connected') kind='preview';
        else if(res.ok && res.json && res.json.ok) kind='ok';
        var box=$('.form-result[data-result="'+kind+'"]',f.parentNode) || $('.form-result[data-result="'+kind+'"]',f.parentNode.parentNode);
        if(!box){ box=$('.form-result[data-result="'+kind+'"]'); }
        $$('.form-result', f.parentNode.parentNode||f.parentNode).forEach(function(el){ el.classList.remove('on'); });
        if(box){ box.classList.add('on'); box.setAttribute('tabindex','-1'); box.focus(); }
        if(kind==='ok' || kind==='preview'){
          $$('input,textarea,select,button[type=submit]',f).forEach(function(el){ el.disabled=true; });
        } else if(btn){ btn.disabled=false; }
      })
      .catch(function(){
        if(btn) btn.disabled=false;
        var box=$('.form-result[data-result="error"]',f.parentNode.parentNode||f.parentNode);
        if(box){ box.classList.add('on'); box.setAttribute('tabindex','-1'); box.focus(); }
      });
  });
});

/* ---------- NetArmored AI Advisor — scripted guided demo (not a live AI service) ---------- */
var A={
  start:{t:"Hi — I'm the NetArmored Advisor <b>guided demo</b>. I follow a fixed script built from this website's content; I'm not a live AI and nothing you type leaves this page. What would you like to explore?",q:['services','secure','industries','which','process','human']},
  services:{t:"NetArmored works in six areas: <a href='/solutions/ai-strategy/'>AI Strategy &amp; Business Discovery</a>, <a href='/solutions/ai-integration-automation/'>AI Integration &amp; Automation</a> and <a href='/solutions/managed-ai-optimization/'>Managed AI Optimization</a>. Most businesses start with discovery so the technology follows the business goal.",q:['which','secure','process']},
  secure:{t:"Security is designed in from the first conversation: least-privilege access, data minimization, encryption in transit and at rest, human approval for consequential actions, vendor evaluation and audit trails. These are recommended engineering practices — not a certification. More on the <a href='/security/'>Security &amp; Trust page</a>.",q:['models','human','services']},
  models:{t:"<b>Cloud AI</b> is fast to start and very capable. <b>Private / local AI</b> keeps sensitive data inside infrastructure you control. <b>Hybrid</b> routes sensitive work privately and general work to the cloud. The right mix depends on privacy, performance, functionality and cost.",q:['secure','which','human']},
  industries:{t:"The Las Vegas hospitality experience is the most developed: <a href='/industries/las-vegas-hospitality/'>bars, restaurants, gaming and live entertainment</a>. There are also previews for retail, professional services, logistics, home services, healthcare administration and general small business on the <a href='/industries/'>Industries page</a>.",q:['hosp','which','roi']},
  hosp:{t:"For a bar or restaurant with gaming, a common starting point is coordinated promotions for events and specials (with manager approval before anything posts), then connecting POS, labor and event costs to see which nights actually pay off. Gaming-related ideas always go through Nevada regulatory and vendor review first.",q:['scanh','roi','human']},
  which:{t:"If you know your industry, a tailored scan asks better questions. Otherwise the general scan works for any business. Both take about three minutes and show your results right away — no contact details required.",q:['scang','scanh','industries']},
  scang:{t:"Here's the <a href='/scan/'>general AI Opportunity Scan</a>. Five questions, a preliminary snapshot at the end.",q:['process','human']},
  scanh:{t:"Here's the <a href='/scan/'>hospitality AI Opportunity Scan</a> for bars, restaurants, gaming and live entertainment.",q:['process','human']},
  process:{t:"Five stages: <b>Discover</b> the operation, <b>Build the Foundation</b>, <b>Transform</b> with automation and AI, <b>Secure &amp; Govern</b>, then <b>Optimize &amp; Grow</b>. Security runs through every stage. Details on <a href='/how-we-work/'>How We Work</a>.",q:['roi','human','services']},
  roi:{t:"The <a href='/roi/'>ROI Explorer</a> lets you plug in your own numbers to see hours that could be recovered and what that capacity is worth. It's an illustrative scenario tool — recovered capacity isn't the same as cash savings, and nothing is guaranteed.",q:['which','human']},
  human:{t:"You can reach NetArmored at <a href='mailto:hello@netarmored.com'>hello@netarmored.com</a> or <a href='tel:+17027140714'>(702) 714-0714</a>. Current clients can use <a href='mailto:support@netarmored.com'>support@netarmored.com</a>. Or request a discovery consultation on the <a href='/contact/'>Contact page</a>. Please never share passwords, card numbers or customer records in a chat or form.",q:['summary','start']},
  summary:{t:null,q:['human','start']},
  fallback:{t:"I'm a scripted demo, so I only know what's on this site. Try one of these topics, or talk to a person through the <a href='/contact/'>Contact page</a>.",q:['services','secure','industries','human']},
  sensitive:{t:"Please don't share passwords, payment card numbers or confidential customer records here — I don't need them, and a real assistant shouldn't ask for them either.",q:['human','start']}
};
var LBL={services:'What does NetArmored do?',secure:'How is AI kept secure?',industries:'Industry examples',which:'Which assessment is right for me?',process:'How does a project work?',human:'Talk to a person',models:'Private vs cloud vs hybrid AI',hosp:'Bars, restaurants & gaming',scang:'General scan',scanh:'Hospitality scan',roi:'Estimate the value',summary:'Summarize what I told you',start:'Start over'};
var KW=[[/password|card number|credit card|ssn|social security|login/i,'sensitive'],[/privat|local|cloud|hybrid|on-?prem/i,'models'],[/secur|safe|privacy|govern|risk|compliance|encrypt/i,'secure'],[/bar|restaurant|casino|gaming|hospitality|vegas|music|event/i,'hosp'],[/industr|retail|logistic|health|home service|professional/i,'industries'],[/scan|assess|quiz|question/i,'which'],[/roi|cost|save|saving|value|hours|price|pricing/i,'roi'],[/process|how.*work|step|stage|method/i,'process'],[/service|offer|do you do|solution/i,'services'],[/human|person|call|contact|talk|consult|meet/i,'human'],[/summar/i,'summary']];
var advBtn=$('#adv-btn'), adv=$('#adv');
if(advBtn&&adv){
  var log=$('.adv-log',adv), said=[];
  function add(html,who){ var m=d.createElement('div'); m.className='msg '+who; if(who==='me') m.textContent=html; else m.innerHTML=html; log.appendChild(m); log.scrollTop=log.scrollHeight; }
  function qrs(keys){ var w=d.createElement('div'); w.className='qr'; keys.forEach(function(k){ var b=d.createElement('button'); b.type='button'; b.textContent=LBL[k]; b.addEventListener('click',function(){ w.remove(); add(LBL[k],'me'); go(k); }); w.appendChild(b); }); log.appendChild(w); log.scrollTop=log.scrollHeight; }
  function go(k){ var n=A[k]||A.fallback; var t=n.t; if(k==='summary'){ t= said.length? 'Here is what you typed in this chat (kept only on this page): <ul>'+said.slice(-5).map(function(s){return '<li>'+s.replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];})+'</li>';}).join('')+'</ul>A consultant would use this as a starting point — I haven\'t analyzed your business.' : "You haven't typed any details yet, so there's nothing to summarize. I won't assume anything about your business."; }
    setTimeout(function(){ add(t,'bot'); qrs(n.q); }, RM?0:260); }
  var started=false;
  function open(o){ adv.classList.toggle('open',o); advBtn.setAttribute('aria-expanded',o); if(o){ if(!started){ started=true; go('start'); } setTimeout(function(){ $('input',adv).focus(); },50);} }
  advBtn.addEventListener('click',function(){ open(!adv.classList.contains('open')); });
  $('.adv-h button',adv).addEventListener('click',function(){ open(false); advBtn.focus(); });
  adv.addEventListener('keydown',function(e){ if(e.key==='Escape'){ open(false); advBtn.focus(); } });
  $('form',adv).addEventListener('submit',function(e){ e.preventDefault(); var i=$('input',adv), v=i.value.trim().slice(0,300); if(!v) return; i.value=''; add(v,'me'); var k='fallback'; for(var j=0;j<KW.length;j++){ if(KW[j][0].test(v)){ k=KW[j][1]; break; } } if(k!=='sensitive'&&k!=='summary') said.push(v); go(k); });
  $$('[data-open-advisor]').forEach(function(b){ b.addEventListener('click',function(e){ e.preventDefault(); open(true); }); });
}
})();
