/* NetArmored AI Opportunity Scan — deterministic, client-side recommendation engine.
   Runs entirely in the browser. Answers are held in memory only: nothing is stored, sent or logged. */
(function(){
'use strict';
var root=document.getElementById('scan'); if(!root) return;
var RM=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function has(a,v){return a&&a.indexOf(v)>-1;}
function any(a,vs){return vs.some(function(v){return has(a,v);});}

/* ---------------- Industry definitions (add a new industry here; no page rebuild needed) ---------------- */
var IND={
 general:{name:'General small business',short:'your business'},
 hospitality:{name:'Las Vegas hospitality',short:'your establishment',custom:true},
 retail:{name:'Retail & convenience',short:'your store',q1:{title:'What drives most of your revenue?',opts:[['instore','In-store sales','Walk-in customers and repeat shoppers'],['online','Online or delivery orders','Website, marketplace or delivery apps'],['both','A mix of in-store and online',''],['wholesale','Wholesale or B2B accounts',''],['unsure','Not sure yet','']]}},
 professional:{name:'Professional services',short:'your firm',q1:{title:'How does your firm earn most of its revenue?',opts:[['billable','Billable hours','Time-based client work'],['project','Fixed-fee projects',''],['retainer','Retainers or recurring clients',''],['mixed','A mix of these',''],['unsure','Not sure yet','']]}},
 logistics:{name:'Logistics & transportation',short:'your operation',q1:{title:'What generates most of your revenue?',opts:[['delivery','Local delivery runs',''],['freight','Freight / long-haul loads',''],['contract','Dedicated contracts for a few customers',''],['warehouse','Warehousing and fulfillment',''],['unsure','Not sure yet','']]}},
 home:{name:'Home services & field operations',short:'your company',q1:{title:'Where does most of your revenue come from?',opts:[['service','Service calls and repairs',''],['install','Installations and projects',''],['maint','Maintenance plans and recurring visits',''],['emerg','Emergency / after-hours work',''],['unsure','Not sure yet','']]}},
 healthcare:{name:'Healthcare administration',short:'your practice',q1:{title:'How is most of your revenue generated?',opts:[['insurance','Insurance-billed appointments',''],['selfpay','Self-pay services',''],['mixed','A mix of insurance and self-pay',''],['programs','Memberships or programs',''],['unsure','Not sure yet','']]}},
 restaurant:{name:'Restaurants (no gaming)',short:'your restaurant',q1:{title:'What generates the most revenue for your restaurant?',opts:[['dinein','Dine-in food sales',''],['bev','Beverage and bar sales',''],['offprem','Takeout, delivery and catering',''],['mixed','A balanced combination',''],['unsure','Not sure yet','']]}}
};
var GEN_Q1={title:'How does your business make money?',help:'Pick every close fit. This tailors the examples and recommendations.',opts:[['products','Selling products','In-store, online, or both','retail'],['services','Delivering services by appointment or project','','professional'],['hospitality','Food, drinks and entertainment','Bars, restaurants, venues','hospitality'],['field','On-site / field services','Repairs, installs, maintenance','home'],['transport','Moving or delivering goods','','logistics'],['health','Healthcare-related services','Administrative side only','healthcare'],['other','Something else','','general']]};

/* ---------------- Question sets ---------------- */
var GQ=[
 null, // Q1 set per industry
 {id:'frustration',title:'What\u2019s your biggest business frustration right now?',help:'Select all that apply \u2014 choose every one that costs you sleep.',type:'multi',opts:[['staff','Staffing and workload','Not enough hands, or the wrong work on them'],['admin','Administrative workload','Paperwork, data entry, back-office'],['cost','Operating costs','Margins feel squeezed'],['acquire','Winning new customers',''],['response','Slow responses to customers','Leads and requests wait too long'],['visibility','Reporting and visibility','Hard to see what\u2019s really working'],['growth','Growing without chaos','What works now won\u2019t scale'],['security','Technology or security worries','']],text:'Anything else about it? (optional)'},
 {id:'timesinks',title:'Where does your team spend the most unnecessary time?',help:'Select all that apply.',type:'multi',opts:[['entry','Typing the same data into multiple places',''],['sched','Scheduling and rescheduling',''],['comms','Answering routine customer questions',''],['report','Building reports and spreadsheets',''],['coord','Chasing updates and handoffs',''],['docs','Handling documents, forms and intake',''],['inventory','Inventory, ordering and supplies',''],['invoice','Invoicing and payment follow-up','']]},
 {id:'tech',title:'What technology currently supports your business?',help:'Select all that apply \u2014 categories only, no product names or logins needed.',type:'multi',opts:[['sheets','Spreadsheets or paper',''],['email','Email and shared calendars',''],['acct','Accounting software',''],['pos','Point-of-sale (POS)',''],['crm','CRM or customer database',''],['schedsw','Scheduling or booking software',''],['industry','Industry-specific software',''],['cloud','Cloud file storage',''],['network','Our own servers or managed network',''],['limited','Very little \u2014 we\u2019re starting from scratch','']],exclusive:'limited'},
 {id:'outcome',title:'What result would make the biggest difference?',help:'Select all that apply \u2014 every outcome that matters.',type:'multi',opts:[['time','Give my team time back',''],['response','Respond to customers faster',''],['revenue','Win more business',''],['visibility','See clearly what\u2019s working',''],['cost','Reduce operating costs',''],['scale','Grow without adding chaos','']],readiness:true}
];
var HQ=[
 {id:'q1',title:'What generates the most revenue for your establishment?',help:'Select all that apply.',type:'multi',opts:[['gaming','Gaming',''],['food','Food and restaurant sales',''],['bev','Alcohol and beverage sales',''],['combo','Combination of food, beverages and gaming',''],['unsure','Not sure yet','']],extra:[['estname','Establishment name','optional'],['revdetail','Additional revenue details','optional']]},
 {id:'promo',title:'How do you currently promote events and attract returning customers?',help:'Select all that apply.',type:'multi',opts:[['social','Social media posts',''],['specials','Food and drink specials',''],['music','Live music and entertainment',''],['messaging','Customer text or email messaging',''],['calendar','An events calendar',''],['loyalty','Loyalty or player programs',''],['wom','Mostly word of mouth','']]},
 {id:'ops',title:'What are the biggest operational problems?',help:'Select all that apply.',type:'multi',opts:[['inventory','Inventory and ordering',''],['waste','Food waste',''],['staffing','Staffing',''],['scheduling','Scheduling',''],['marketing','Marketing takes too much time',''],['reporting','Reporting',''],['slow','Slow nights',''],['admin','Manual administration','']]},
 {id:'systems',title:'Which systems do you use?',help:'Categories only. Never enter logins, player data or gaming-system details here.',type:'multi',opts:[['pos','POS',''],['acct','Accounting',''],['inventorysw','Inventory',''],['schedsw','Staff scheduling',''],['marketingsw','Marketing / email / text tools',''],['gamingvendor','Gaming provider relationship',''],['sheets','Spreadsheets or paper',''],['limited','Not sure / very little','']],exclusive:'limited'},
 {id:'improve',title:'What improvement matters most?',help:'Select all that apply, then tell us where you are on investing.',type:'multi',opts:[['traffic','More customer traffic',''],['fnb','Food and beverage profitability',''],['event','Event profitability',''],['efficiency','Operational efficiency',''],['repeat','More repeat visits',''],['visibility','Management visibility','']],readiness:true}
];
var READY=[['explore','Just exploring what\u2019s possible'],['pilot','Ready for a focused pilot project'],['broad','Ready for a broader transformation'],['foundation','We need the technology foundation first']];

/* ---------------- Follow-ups (only the single highest-value clarification is asked) ---------------- */
var FU={
 event:{tag:'High-value discovery question',title:'Think about your last major live music event or gaming giveaway. Do you know what it cost, how much additional business it generated, and whether those customers came back?',opts:[['all','Yes \u2014 cost, lift and return visits'],['cost','We know the cost, not the results'],['rough','We have a rough feel'],['no','Honestly, not really']]},
 entry:{tag:'One clarifying question',title:'Do you re-type the same information (customers, orders, hours) into more than one system?',opts:[['daily','Yes, every day'],['weekly','Yes, a few times a week'],['rare','Rarely'],['unsure','Not sure']]},
 comms:{tag:'One clarifying question',title:'When a customer reaches out after hours or during a rush, what usually happens?',opts:[['next','They wait until someone is free'],['missed','Some inquiries get missed'],['covered','We have coverage'],['unsure','Not sure']]},
 staff:{tag:'One clarifying question',title:'Roughly how much of your team\u2019s week goes to admin rather than customers or core work?',opts:[['lt10','Less than 10%'],['10_25','10\u201325%'],['25_50','25\u201350%'],['gt50','More than half'],['unsure','Not sure']]},
 data:{tag:'One clarifying question',title:'Where does your sales and cost information live today?',opts:[['exports','In POS / accounting exports'],['sheets','In spreadsheets'],['scattered','Scattered or unsure'],['dash','We already have a dashboard']]}
};

/* ---------------- Opportunity catalog ---------------- */
var OPP=[
 {id:'q_comms',tier:'quick',t:'AI-assisted customer response',b:'Draft accurate first responses to routine questions and requests from your approved information, with staff reviewing anything unusual before it is sent.',imp:3,eff:2,needs:['email','crm','marketingsw'],tr:{f:['response','acquire'],ts:['comms'],o:['response','revenue','traffic']}},
 {id:'q_mkt',tier:'quick',t:'Coordinated promotions assistant',b:'Prepare consistent promotions across channels from one brief, with management approval before anything is published.',imp:3,eff:2,needs:['marketingsw','email'],tr:{f:['acquire'],ts:['marketing'],o:['revenue','traffic','repeat','event']}},
 {id:'q_docs',tier:'quick',t:'Document and intake automation',b:'Capture information from forms, emails and documents once, check it, and route it to the right place automatically.',imp:3,eff:2,needs:['email','cloud'],tr:{f:['admin'],ts:['docs','entry'],o:['time']}},
 {id:'q_report',tier:'quick',t:'Automated weekly management report',b:'A plain-English weekly summary assembled from the data you already have, so decisions don\u2019t wait on someone building spreadsheets.',imp:3,eff:2,needs:['acct','pos','sheets'],tr:{f:['visibility'],ts:['report','reporting'],o:['visibility']}},
 {id:'q_sched',tier:'quick',t:'Scheduling and reminder automation',b:'Reduce back-and-forth with automated booking, confirmations, reminders and shift-swap requests that a manager approves.',imp:3,eff:2,needs:['schedsw','email'],tr:{f:['staff'],ts:['sched','scheduling','staffing'],o:['time','efficiency']}},
 {id:'q_admin',tier:'quick',t:'Back-office task automation',b:'Automate repetitive admin steps \u2014 invoice follow-ups, status updates, data clean-up \u2014 often with simple workflow tools before any AI is needed.',imp:2,eff:1,needs:['acct','email'],tr:{f:['admin','cost','staff'],ts:['invoice','coord','admin'],o:['time','cost','efficiency']}},
 {id:'i_sync',tier:'integ',t:'Connect your core systems',b:'Integrate the applications you already use so information is entered once and flows where it is needed, ending duplicate entry.',imp:4,eff:3,needs:['acct','pos','crm','schedsw','industry','inventorysw'],tr:{f:['admin','growth'],ts:['entry','coord'],o:['time','scale','efficiency']}},
 {id:'i_profit',tier:'integ',t:'Profitability intelligence',b:'Combine sales, labor and cost data to compare which products, services, days or promotions actually make money.',imp:4,eff:3,needs:['pos','acct','sheets'],tr:{f:['visibility','cost'],ts:['report','reporting'],o:['visibility','cost','fnb','event']}},
 {id:'i_crm',tier:'integ',t:'Customer follow-up and retention workflow',b:'Connect inquiries, customer records and messaging so every lead gets a timely follow-up and past customers are invited back.',imp:4,eff:3,needs:['crm','email','marketingsw','pos'],tr:{f:['acquire','response'],ts:['comms'],o:['revenue','repeat','traffic','response']}},
 {id:'i_inv',tier:'integ',t:'Inventory and ordering workflow',b:'Link sales to stock levels and ordering so reorders, waste and shortages become visible before they cost money.',imp:4,eff:3,needs:['pos','inventorysw','acct'],tr:{f:['cost'],ts:['inventory','waste'],o:['cost','fnb']}},
 {id:'i_dispatch',tier:'integ',t:'Dispatch and scheduling integration',b:'Connect job requests, schedules and field updates so the office and crews work from the same live picture.',imp:4,eff:3,needs:['schedsw','industry','crm'],tr:{f:['staff','growth'],ts:['sched','coord'],o:['time','scale']},ind:['logistics','home']},
 {id:'l_ops',tier:'long',t:'Integrated intelligent operations platform',b:'A connected platform for forecasting, scheduling, customer engagement and reporting that grows with the business.',imp:5,eff:5,needs:['pos','acct','crm','industry'],tr:{f:['growth','visibility'],o:['scale','visibility','fnb','event']}},
 {id:'l_forecast',tier:'long',t:'Demand forecasting and resource planning',b:'Use your own history to anticipate busy and slow periods, then plan staffing, purchasing and promotions around them.',imp:5,eff:4,needs:['pos','schedsw','inventorysw','acct'],tr:{f:['staff','cost'],ts:['inventory','sched','scheduling','slow','waste'],o:['cost','efficiency','traffic']}},
 {id:'l_agents',tier:'long',t:'Coordinated AI agents with approval boundaries',b:'Specialized assistants that handle multi-step routine work across systems, operating within defined limits and escalating to people for approval.',imp:5,eff:5,needs:['crm','acct','cloud','industry'],tr:{f:['admin','growth','staff'],ts:['coord','entry'],o:['scale','time']}},
 {id:'l_found',tier:'long',t:'Secure technology foundation roadmap',b:'A staged plan for connectivity, identity, data organization and security so later automation and AI have something solid to build on.',imp:4,eff:3,needs:[],tr:{f:['security','growth'],o:['scale']},foundation:true}
];
var OV={
 hospitality:{q_mkt:{t:'Intelligent Events and Promotions',b:'An AI-assisted system that prepares coordinated promotions for live music, food specials and other approved events, with management review before publication. Gaming-related promotions follow your approved operator procedures.'},i_profit:{t:'Profitability Intelligence',b:'Combine available POS data, event expenses, labor information and food costs to compare the financial performance of different events and promotions.'},l_ops:{t:'Intelligent Hospitality Operations',b:'An integrated business platform supporting demand forecasting, inventory, scheduling, customer engagement, marketing analytics and management reporting.'},i_inv:{t:'Inventory, waste and ordering intelligence',b:'Connect sales to bar and kitchen inventory so pours, waste and reorders are visible by shift and by event.'}},
 restaurant:{i_inv:{t:'Food cost and ordering intelligence',b:'Tie menu sales to ingredient usage and supplier orders so food cost and waste become visible week to week.'}},
 retail:{l_forecast:{t:'Demand forecasting for inventory and staffing',b:'Use your sales history to anticipate seasonal demand and staff and stock accordingly.'}},
 healthcare:{q_comms:{t:'Administrative inquiry assistant',b:'Help staff answer routine scheduling and administrative questions from approved information. It does not give clinical advice or make clinical decisions.'},q_docs:{t:'Administrative intake and records workflow',b:'Reduce manual re-entry of administrative intake information, with access controls and human review appropriate for health information.'}},
 home:{q_comms:{t:'Service request capture and estimate drafts',b:'Capture service requests completely the first time and draft estimates for staff to review and send.'}},
 logistics:{q_docs:{t:'Shipping documentation automation',b:'Extract and route information from bills of lading, PODs and delivery paperwork so it is typed once.'}},
 professional:{q_docs:{t:'Client onboarding and document workflow',b:'Collect, check and organize client documents and onboarding steps automatically, with secure storage.'}}
};

/* ---------------- State ---------------- */
var S={ind:null,step:-1,a:{},fu:null,fuA:null,dir:1};
var params=new URLSearchParams(location.search); var qi=params.get('industry');
if(qi && IND[qi]){ S.ind=qi; S.step=0; }

function questions(){
  if(S.ind==='hospitality') return HQ;
  var q1;
  if(S.ind && S.ind!=='general' && IND[S.ind].q1){ var d=IND[S.ind].q1; q1={id:'q1',title:d.title,help:'Tailored for '+IND[S.ind].name.toLowerCase()+'. Select all that apply.',type:'multi',opts:d.opts,extra:[['bizname','Business name','optional']],text:'Customer types or other details (optional)'}; }
  else q1={id:'q1',title:GEN_Q1.title,help:GEN_Q1.help+' Select all that apply.',type:'multi',opts:GEN_Q1.opts,extra:[['bizname','Business name','optional']],text:'Who are your customers? (optional)'};
  var arr=GQ.slice(); arr[0]=q1; return arr;
}
function effInd(){ if(S.ind && S.ind!=='general') return S.ind; var v=S.a.q1; if(v){ var vals=Array.isArray(v)?v:[v]; for(var i=0;i<vals.length;i++){ var o=GEN_Q1.opts.filter(function(x){return x[0]===vals[i];})[0]; if(o && o[3]) return o[3]; } } return 'general'; }

/* normalize answers into shared tags */
function tags(){
  var a=S.a, t={f:[],ts:[],tech:[],o:[],ready:a.ready||'explore'};
  if(S.ind==='hospitality'){
    var ops=a.ops||[], pr=a.promo||[];
    var map={inventory:['inventory'],waste:['waste','inventory'],staffing:['staffing'],scheduling:['scheduling','sched'],marketing:['marketing'],reporting:['reporting','report'],slow:['slow'],admin:['admin','entry']};
    ops.forEach(function(o){ t.ts=t.ts.concat(map[o]||[]); });
    if(!has(pr,'messaging')&&!has(pr,'loyalty')) t.ts.push('comms');
    if(has(pr,'wom')||pr.length<=1) t.f.push('acquire');
    if(any(ops,['staffing','scheduling'])) t.f.push('staff');
    if(any(ops,['reporting'])) t.f.push('visibility');
    if(any(ops,['inventory','waste'])) t.f.push('cost');
    if(any(ops,['admin','marketing'])) t.f.push('admin');
    if(any(pr,['music','specials','calendar'])) t.ts.push('marketing');
    t.tech=(a.systems||[]).slice();
    var imp=a.improve; var imps=Array.isArray(imp)?imp:[imp];
    imps.forEach(function(i){ if(i) t.o.push(i); });
    if(any(imps,['traffic','repeat'])) t.f.push('acquire');
    if(has(imps,'efficiency')) t.f.push('staff');
    if(any(imps,['fnb','event'])) t.f.push('visibility');
  } else {
    t.f=(a.frustration||[]).slice();
    t.ts=(a.timesinks||[]).slice();
    t.tech=(a.tech||[]).slice();
    var outs=a.outcome||[]; outs=Array.isArray(outs)?outs:[outs];
    outs.forEach(function(o){ if(o) t.o.push(o); });
  }
  return t;
}

/* score and pick opportunities */
function score(op, t, ind){
  var s=0;
  if(op.ind && op.ind.indexOf(ind)===-1) return -1;
  var f=t.f||[], ts=t.ts||[], o=t.o||[], tech=t.tech||[];
  (op.tr.f||[]).forEach(function(v){ if(has(f,v)) s+=3; });
  (op.tr.ts||[]).forEach(function(v){ if(has(ts,v)) s+=2; });
  (op.tr.o||[]).forEach(function(v){ if(has(o,v)) s+=2; });
  if(op.needs && op.needs.length){
    var hasNeed=op.needs.some(function(n){ return has(tech,n); });
    if(hasNeed) s+=1; else s-=1;
  }
  if(op.foundation && has(f,'security')) s+=2;
  // boost if starred answer matches a trigger
  var star=S.a.frustration_star || S.a.timesinks_star || S.a.outcome_star || S.a.ops_star || S.a.improve_star;
  if(star && ((op.tr.f||[]).indexOf(star)>-1 || (op.tr.ts||[]).indexOf(star)>-1 || (op.tr.o||[]).indexOf(star)>-1)) s+=4;
  return s;
}
function pick(){
  var t=tags(), ind=effInd(), scored=[];
  OPP.forEach(function(op){ var sc=score(op,t,ind); if(sc>0) scored.push({op:op,sc:sc}); });
  scored.sort(function(a,b){ return b.sc-a.sc || (a.op.tier==='quick'?-1:1); });
  var tiers={quick:[],integ:[],long:[]};
  scored.forEach(function(x){ if(tiers[x.op.tier].length<3) tiers[x.op.tier].push(x); });
  var ov=OV[ind]||{};
  ['quick','integ','long'].forEach(function(tier){
    tiers[tier].forEach(function(x){
      if(ov[x.op.id]){ x.op=Object.assign({},x.op,ov[x.op.id]); }
    });
  });
  return {tiers:tiers,t:t,ind:ind};
}
function pickFollowUp(){
  var t=tags();
  if(S.ind==='hospitality' && (has(t.ts,'marketing')||has(S.a.promo||[],'music'))) return 'event';
  if(has(t.ts,'entry')||has(t.f,'admin')) return 'entry';
  if(has(t.ts,'comms')||has(t.f,'response')) return 'comms';
  if(has(t.f,'staff')||has(t.ts,'sched')) return 'staff';
  if(has(t.f,'visibility')||has(t.ts,'report')) return 'data';
  return null;
}

/* ---------------- UI ---------------- */
function getBody(){
  var b=document.querySelector('.scan-body');
  if(b) return b;
  var shell=document.querySelector('.scan-shell');
  if(!shell){
    root.innerHTML='<div class="scan-shell"><div class="scan-top"><span class="lbl">Choose your scan</span><div class="prog" aria-hidden="true"><span style="width:0"></span></div></div><div class="scan-body"></div></div>';
    shell=root.querySelector('.scan-shell');
  }
  b=shell.querySelector('.scan-body');
  if(!b){ b=document.createElement('div'); b.className='scan-body'; shell.appendChild(b); }
  return b;
}
var body=getBody();
var lblEl=document.getElementById('scan-lbl')||document.querySelector('.scan-top .lbl');
var progEl=document.getElementById('scan-prog')||document.querySelector('.scan-top .prog span');
var first=true;
function setTop(step,total){
  if(lblEl) lblEl.textContent = (S.ind ? (IND[S.ind]||{}).name||'' : '') + (step>=0 ? ' · '+(step+1)+' of '+total : '');
  if(!progEl) return;
  var pct=Math.max(0,Math.min(100, (step<0?0:step+1)/total*100 ));
  progEl.style.width=pct+'%';
}
function focusTitle(){
  var t=getBody().querySelector('.qtitle'); if(t){ t.setAttribute('tabindex','-1'); t.focus(); }
}
function render(){
  if(S.step===-1) renderTrack();
  else if(S.step==='fu') renderFU();
  else if(S.step==='think') finish();
  else if(S.step==='done') renderDone();
  else if(typeof S.step==='number') renderQ();
  if(S.step!=='think' && !first) focusTitle();
  first=false;
}
function renderTrack(){
  var keys=['hospitality','restaurant','retail','professional','logistics','home','healthcare','general'];
  var desc={hospitality:'Bars, restaurants, venues with or without gaming',restaurant:'Restaurants and bars (no gaming focus)',retail:'Stores, convenience, specialty retail',professional:'Agencies, firms, consultants',logistics:'Delivery, freight, transportation',home:'Contractors, home services, field ops',healthcare:'Practices and healthcare admin (non-clinical)',general:'Other small businesses'};
  getBody().innerHTML='<div class="qwrap"><p class="qnum">Before we begin</p><h2 class="qtitle">Which scan fits your business?</h2><p class="qhelp">Every scan uses the same five-question structure, with examples and recommendations adapted to the industry.</p><div class="track-pick" role="radiogroup" aria-label="Scan type">'+keys.map(function(k){return '<label class="ans"><input type="radio" name="track" value="'+k+'"'+(S.ind===k?' checked':'')+'><span class="box" aria-hidden="true"></span><span><b>'+esc(IND[k].name)+(k==='hospitality'?' \u2605':'')+'</b><span class="d">'+esc(desc[k])+'</span></span></label>';}).join('')+'</div><p class="err" id="err-track" role="alert">Please choose a scan to continue.</p><div class="scan-nav"><span></span><button type="button" class="btn btn-p" data-act="begin">Begin scan <span class="arr" aria-hidden="true">\u2192</span></button></div></div>';
  getBody().querySelector('[data-act=begin]').addEventListener('click',function(){ var c=getBody().querySelector('input[name=track]:checked'); if(!c){ var e=document.getElementById('err-track'); e.classList.add('on'); getBody().querySelector('input[name=track]').focus(); return;} if(c.value!==S.ind){ S.a={}; S.fu=null; S.fuA=null; } S.ind=c.value; S.step=0; S.dir=1; render(); });
}
function renderQ(){
  var qs=questions(), q=qs[S.step], total=5, n=S.step+1;
  if(lblEl) lblEl.textContent=(S.ind==='hospitality'?'Hospitality scan':IND[S.ind].name+' scan')+' \u00b7 '+n+' of '+total; setTop(S.step,total);
  var cur=S.a[q.id], multi=q.type==='multi';
  if(multi && q.help && q.help.indexOf('star')===-1) q.help = (q.help||'') + ' Select all that apply, then star \u2605 the most important one.';
  var h='<div class="qwrap'+(S.dir<0?' back':'')+'"><p class="qnum">'+(S.ind==='hospitality'?'Discovery \u2014 ':'')+'Question '+n+' of '+total+'</p><h2 class="qtitle" id="qt">'+esc(q.title)+'</h2><p class="qhelp">'+esc(q.help&&q.help.indexOf('Discovery')===0?'Pick the closest fit.':q.help||'')+'</p>';
  h+='<div class="answers" role="'+(multi?'group':'radiogroup')+'" aria-labelledby="qt">';
  q.opts.forEach(function(o){ var on=multi?has(cur||[],o[0]):cur===o[0]; var starred=multi && S.a[q.id+'_star']===o[0]; h+='<label class="ans'+(multi?' multi':'')+'"><input type="'+(multi?'checkbox':'radio')+'" name="q" value="'+o[0]+'"'+(on?' checked':'')+'><span class="box" aria-hidden="true"></span><span><b>'+esc(o[1])+'</b>'+(o[2]?'<span class="d">'+esc(o[2])+'</span>':'')+'</span>'+(multi?'<button type="button" class="star-btn'+(starred?' on':'')+'" data-val="'+o[0]+'" aria-label="Mark as most important" '+(on?'':'disabled')+'>\u2605</button>':'')+'</label>'; });
  h+='</div><p class="err" id="err-q" role="alert">'+(multi?'Select at least one option.':'Please choose an option.')+'</p>';
  if(q.readiness){ h+='<div class="field"><span class="flabel" id="rl">Where are you on investing in improvements?</span><div class="answers" role="radiogroup" aria-labelledby="rl">'+READY.map(function(r){return '<label class="ans"><input type="radio" name="ready" value="'+r[0]+'"'+(S.a.ready===r[0]?' checked':'')+'><span class="box" aria-hidden="true"></span><span><b>'+esc(r[1])+'</b></span></label>';}).join('')+'</div><p class="err" id="err-r" role="alert">Please choose where you are on investing.</p></div>'; }
  (q.extra||[]).forEach(function(x){ h+='<div class="field"><label for="x-'+x[0]+'">'+esc(x[1])+'<span class="opt-l">'+esc(x[2])+'</span></label><input type="text" id="x-'+x[0]+'" maxlength="120" autocomplete="off" value="'+esc(S.a[x[0]]||'')+'"></div>'; });
  if(q.text){ h+='<div class="field"><label for="x-text">'+esc(q.text)+'</label><textarea id="x-text" maxlength="500">'+esc(S.a[q.id+'_text']||'')+'</textarea></div>'; }
  if(q.id==='systems'||q.id==='tech') h+='<p class="small muted" style="margin-top:14px">Please don\u2019t enter passwords, account numbers, customer records'+(S.ind==='hospitality'?', patron gambling history or gaming-system details':'')+'.</p>';
  h+='<div class="scan-nav"><button type="button" class="btn btn-g" data-act="back"><span aria-hidden="true">\u2190</span> Back</button><button type="button" class="btn btn-p" data-act="next">'+(n===total?'Continue':'Next')+' <span class="arr" aria-hidden="true">\u2192</span></button></div></div>';
  getBody().innerHTML=h;
  if(multi){
    var stars=getBody().querySelectorAll('.star-btn');
    function syncStars(){
      stars.forEach(function(s){
        var inp=s.parentElement.querySelector('input');
        s.disabled=!inp.checked;
        s.classList.toggle('on', S.a[q.id+'_star']===s.dataset.val && inp.checked);
      });
    }
    stars.forEach(function(s){
      s.addEventListener('click',function(e){
        e.preventDefault(); e.stopPropagation();
        var val=s.dataset.val;
        var inp=s.parentElement.querySelector('input');
        if(!inp.checked) return;
        S.a[q.id+'_star'] = (S.a[q.id+'_star']===val) ? null : val;
        syncStars();
      });
    });
    getBody().querySelectorAll('input[name=q]').forEach(function(i){
      i.addEventListener('change',function(){
        if(!i.checked && S.a[q.id+'_star']===i.value) S.a[q.id+'_star']=null;
        syncStars();
      });
    });
    syncStars();
  }
  if(q.exclusive){ getBody().querySelectorAll('input[name=q]').forEach(function(i){ i.addEventListener('change',function(){ if(!i.checked) return; getBody().querySelectorAll('input[name=q]').forEach(function(j){ if(i.value===q.exclusive && j!==i) j.checked=false; if(i.value!==q.exclusive && j.value===q.exclusive) j.checked=false; }); }); }); }
  if(!multi && !q.readiness && !q.extra && !q.text){ getBody().querySelectorAll('input[name=q]').forEach(function(i){ i.addEventListener('change',function(){ setTimeout(next, RM?0:240); }); }); }
  getBody().querySelector('[data-act=back]').addEventListener('click',function(){ save(q); S.dir=-1; if(S.step===0){ S.step=-1; } else S.step--; render(); });
  getBody().querySelector('[data-act=next]').addEventListener('click',next);
  function next(){ if(!save(q,true)) return; S.dir=1; if(S.step<total-1){ S.step++; render(); } else { S.fu=pickFollowUp(); if(S.fu){ S.step='fu'; render(); } else finish(); } }
}
function save(q,validate){
  var multi=q.type==='multi', ins=[].slice.call(getBody().querySelectorAll('input[name=q]:checked')).map(function(i){return i.value;});
  S.a[q.id]=multi?ins:(ins[0]||null);
  if(multi){
    var starBtn=getBody().querySelector('.star-btn.on');
    S.a[q.id+'_star']=starBtn ? starBtn.dataset.val : (S.a[q.id+'_star']||null);
    if(S.a[q.id+'_star'] && ins.indexOf(S.a[q.id+'_star'])===-1) S.a[q.id+'_star']=null;
  }
  (q.extra||[]).forEach(function(x){ var el=document.getElementById('x-'+x[0]); if(el) S.a[x[0]]=el.value.trim().slice(0,120); });
  var tx=document.getElementById('x-text'); if(tx) S.a[q.id+'_text']=tx.value.trim().slice(0,500);
  var r=getBody().querySelector('input[name=ready]:checked'); if(q.readiness) S.a.ready=r?r.value:S.a.ready;
  if(!validate) return true;
  var ok=true, e=document.getElementById('err-q');
  if(!ins.length){ e.classList.add('on'); getBody().querySelector('input[name=q]').focus(); ok=false; } else e.classList.remove('on');
  if(ok && q.readiness && !r){ var er=document.getElementById('err-r'); er.classList.add('on'); getBody().querySelector('input[name=ready]').focus(); ok=false; }
  return ok;
}
function renderFU(){
  var f=FU[S.fu]; if(lblEl) lblEl.textContent='One clarifying question'; setTop(5,5);
  getBody().innerHTML='<div class="qwrap"><div class="followup" style="margin-top:0"><span class="tag">'+esc(f.tag)+'</span><h2 class="qtitle" id="fq">'+esc(f.title)+'</h2><p class="qhelp" style="margin-bottom:16px">Optional \u2014 it sharpens your snapshot. We only ask the single question most likely to change the recommendation.</p><div class="answers" role="radiogroup" aria-labelledby="fq">'+f.opts.map(function(o){return '<label class="ans"><input type="radio" name="fu" value="'+o[0]+'"'+(S.fuA===o[0]?' checked':'')+'><span class="box" aria-hidden="true"></span><span><b>'+esc(o[1])+'</b></span></label>';}).join('')+'</div></div><div class="scan-nav"><button type="button" class="btn btn-g" data-act="back"><span aria-hidden="true">\u2190</span> Back</button><span style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end"><button type="button" class="btn btn-g" data-act="skip">Skip</button><button type="button" class="btn btn-p" data-act="go">See my snapshot <span class="arr" aria-hidden="true">\u2192</span></button></span></div></div>';
  getBody().querySelector('[data-act=back]').addEventListener('click',function(){ S.dir=-1; S.step=4; render(); });
  getBody().querySelector('[data-act=skip]').addEventListener('click',function(){ S.fuA=null; finish(); });
  getBody().querySelector('[data-act=go]').addEventListener('click',function(){ var c=getBody().querySelector('input[name=fu]:checked'); S.fuA=c?c.value:null; finish(); });
}
function finish(){
  S.step='think'; if(lblEl) lblEl.textContent='Building your snapshot'; setTop(5,5); if(progEl) progEl.style.width='100%';
  getBody().innerHTML='<div class="qwrap" style="text-align:center;padding:40px 20px"><div class="thinking"><span></span><span></span><span></span></div><h2 class="qtitle">Building your snapshot</h2><p class="qhelp">Matching your answers to practical opportunities. This stays in your browser \u2014 nothing is sent.</p></div>';
  setTimeout(function(){ S.step='done'; render(); }, RM?100:900);
}
function renderDone(){
  var res=pick(), tiers=res.tiers, ind=res.ind;
  var h='<div class="qwrap"><p class="qnum">Your AI Opportunity Snapshot</p><h2 class="qtitle">Here\u2019s what fits '+esc(IND[ind].short)+'</h2><p class="qhelp">A practical starting point based on your answers. Starred priorities are weighted higher.</p>';
  var labels={quick:'Quick win',integ:'Integration opportunity',long:'Longer-term roadmap'};
  ['quick','integ','long'].forEach(function(tier){
    var list=tiers[tier];
    if(!list.length) return;
    h+='<div class="tier"><span class="tier-lbl">'+labels[tier]+'</span>';
    list.forEach(function(x){
      var op=x.op;
      h+='<div class="opp"><h3>'+esc(op.t)+'</h3><p>'+esc(op.b)+'</p><div class="scores"><div class="score"><span>Impact</span><div class="m"><i style="width:'+(op.imp*20)+'%"></i></div></div><div class="score"><span>Feasibility</span><div class="m"><i style="width:'+((5-op.eff+1)*16)+'%"></i></div></div><div class="score"><span>Readiness</span><div class="m"><i style="width:60%"></i></div></div></div></div>';
    });
    h+='</div>';
  });
  h+='<div class="snap-actions"><button type="button" class="btn btn-p" data-act="dl">Download my snapshot</button><button type="button" class="btn btn-g" data-act="print">Print / save as PDF</button><a class="btn btn-g" href="/contact/?source=scan-consultation">Schedule a discovery consultation</a><button type="button" class="btn btn-g" data-act="restart">Start over</button></div>';
  h+='</div>';
  getBody().innerHTML=h;
  getBody().querySelector('[data-act=dl]').addEventListener('click',download);
  getBody().querySelector('[data-act=print]').addEventListener('click',function(){ window.print(); });
  getBody().querySelector('[data-act=restart]').addEventListener('click',function(){ S={ind:S.ind,step:-1,a:{},fu:null,fuA:null,dir:-1}; render(); });
}
function download(){
  var res=pick();
  var text='NetArmored AI Opportunity Snapshot\n\nIndustry: '+IND[res.ind].name+'\n\n';
  ['quick','integ','long'].forEach(function(tier){
    res.tiers[tier].forEach(function(x){ text+=x.op.t+'\n'+x.op.b+'\n\n'; });
  });
  text+='Generated in your browser. Nothing was sent or stored.\n';
  var blob=new Blob([text],{type:'text/plain'});
  var a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='netarmored-ai-snapshot.txt'; a.click();
}
render();
window.__naScan={S:S,build:pick};
})();
