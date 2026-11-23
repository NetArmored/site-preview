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
 {id:'frustration',title:'What\u2019s your biggest business frustration right now?',help:'Select all that apply — choose every one that costs you sleep.',type:'multi',opts:[['staff','Staffing and workload','Not enough hands, or the wrong work on them'],['admin','Administrative workload','Paperwork, data entry, back-office'],['cost','Operating costs','Margins feel squeezed'],['acquire','Winning new customers',''],['response','Slow responses to customers','Leads and requests wait too long'],['visibility','Reporting and visibility','Hard to see what\u2019s really working'],['growth','Growing without chaos','What works now won\u2019t scale'],['security','Technology or security worries','']],text:'Anything else about it? (optional)'},
 {id:'timesinks',title:'Where does your team spend the most unnecessary time?',help:'Select all that apply.',type:'multi',opts:[['entry','Typing the same data into multiple places',''],['sched','Scheduling and rescheduling',''],['comms','Answering routine customer questions',''],['report','Building reports and spreadsheets',''],['coord','Chasing updates and handoffs',''],['docs','Handling documents, forms and intake',''],['inventory','Inventory, ordering and supplies',''],['invoice','Invoicing and payment follow-up','']]},
 {id:'tech',title:'What technology currently supports your business?',help:'Select all that apply \u2014 categories only, no product names or logins needed.',type:'multi',opts:[['sheets','Spreadsheets or paper',''],['email','Email and shared calendars',''],['acct','Accounting software',''],['pos','Point-of-sale (POS)',''],['crm','CRM or customer database',''],['schedsw','Scheduling or booking software',''],['industry','Industry-specific software',''],['cloud','Cloud file storage',''],['network','Our own servers or managed network',''],['limited','Very little \u2014 we\u2019re starting from scratch','']],exclusive:'limited'},
 {id:'outcome',title:'What result would make the biggest difference?',help:'Select all that apply — every outcome that matters.',type:'multi',opts:[['time','Give my team time back',''],['response','Respond to customers faster',''],['revenue','Win more business',''],['visibility','See clearly what\u2019s working',''],['cost','Reduce operating costs',''],['scale','Grow without adding chaos','']],readiness:true}
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
    var imp=a.improve; var imps=Array.isArray(imp)?imp:(imp?[imp]:[]); t.o=imps.slice(); imps.forEach(function(im){ if(im==='traffic') t.o.push('revenue'); if(im==='repeat') t.o.push('repeat'); if(im==='visibility') t.o.push('visibility'); if(im==='efficiency') t.o.push('time'); });
    t.primary=a.ops&&a.ops.length? a.ops[0]: (imps[0]||'');
  } else {
    var fr=a.frustration, oc=a.outcome;
    t.f = (fr && fr.selected) ? fr.selected.slice() : (Array.isArray(fr)?fr.slice():(fr?[fr]:[]));
    t.primaryFrust = (fr && fr.primary) ? fr.primary : (t.f[0]||null);
    t.ts=(a.timesinks||[]).slice();
    t.tech=(a.tech||[]).slice();
    t.o = (oc && oc.selected) ? oc.selected.slice() : (Array.isArray(oc)?oc.slice():(oc?[oc]:[]));
    t.primaryOut = (oc && oc.primary) ? oc.primary : (t.o[0]||null);
    t.primary = t.primaryFrust;
  }
  // follow-up refinement
  if(S.fu==='entry' && (S.fuA==='daily'||S.fuA==='weekly')) t.ts.push('entry','entry');
  if(S.fu==='comms' && (S.fuA==='missed'||S.fuA==='next')) t.ts.push('comms'), t.f.push('response');
  if(S.fu==='staff' && (S.fuA==='25_50'||S.fuA==='gt50')) t.f.push('admin','admin');
  if(S.fu==='data' && S.fuA==='scattered') t.tech=t.tech.filter(function(x){return x!=='sheets';});
  if(S.fu==='event' && (S.fuA==='rough'||S.fuA==='no'||S.fuA==='cost')) t.o.push('event','visibility');
  t.limited=has(t.tech,'limited')||t.ready==='foundation';
  return t;
}
function pickFollowUp(){
  if(S.ind==='hospitality'){
    var pr=S.a.promo||[]; var q1v=S.a.q1; var q1s=Array.isArray(q1v)?q1v:(q1v?[q1v]:[]); var impv=S.a.improve; var imps=Array.isArray(impv)?impv:(impv?[impv]:[]); if(any(pr,['music','specials','calendar','loyalty'])||has(imps,'event')||has(q1s,'gaming')||has(q1s,'combo')) return 'event';
    if(has(S.a.ops||[],'admin')) return 'staff'; return 'data';
  }
  var a=S.a, ts=a.timesinks||[], tech=(a.tech||[]).filter(function(x){return x!=='limited'&&x!=='sheets';});
  var fr=a.frustration, frs=Array.isArray(fr)?fr:(fr?[fr]:[]);
  var oc=a.outcome, ocs=Array.isArray(oc)?oc:(oc?[oc]:[]);
  var orderKey = frs[0] || null;
  var order={response:['comms','entry','data'],acquire:['comms','data','entry'],staff:['staff','entry','comms'],admin:['entry','staff','comms'],visibility:['data','entry','comms'],cost:['data','staff','entry'],growth:['entry','data','staff'],security:['data','entry','staff']}[orderKey]||['entry','comms','data'];
  var ok={entry:has(ts,'entry')&&tech.length>=1, comms:has(ts,'comms')||has(frs,'response'), staff:has(frs,'staff')||has(frs,'admin'), data:has(frs,'visibility')||has(ocs,'visibility')||has(frs,'cost')};
  for(var i=0;i<order.length;i++) if(ok[order[i]]) return order[i];
  return null;
}

/* ---------------- Engine ---------------- */
function score(o,t,ind){
  var m=[]; function chk(list,arr,label,weight){ (list||[]).forEach(function(v){ if(has(arr,v)) m.push({label:label(v), w:weight||1}); }); }
  var prim = t.primaryFrust || t.primaryOut || null;
  chk(o.tr.f,t.f,function(v){return (S.ind==='hospitality'?'a challenge you named (':'your main frustration (')+LAB(v)+')';}, function(v){ return (prim && v===prim)?1:0.45; });
  chk(o.tr.ts,t.ts,function(v){return 'time spent on '+LAB(v);}, 1);
  chk(o.tr.o,t.o,function(v){return 'your goal ('+LAB(v)+')';}, function(v){ return (t.primaryOut && v===t.primaryOut)?1:0.45; });
  // unique by label, keep highest weight
  var seen={}; m.forEach(function(x){ if(!seen[x.label] || x.w>seen[x.label]) seen[x.label]=x.w; });
  var weighted = Object.values(seen).reduce(function(a,b){return a+b;},0);
  var imp=Math.min(5,o.imp + weighted*0.6); if(o.ind && has(o.ind,ind)) imp=Math.min(5,imp+0.8);
  var have=o.needs.filter(function(n){return has(t.tech,n);});
  var ready=o.foundation? (t.limited?5:2) : Math.max(1,Math.min(5,1.5+have.length*1.2-(t.limited?1:0)));
  var feas=Math.max(1,6-o.eff);
  if(o.foundation && !t.limited) imp=Math.max(1,imp-1.5);
  if(o.ind && !has(o.ind,ind)) imp=Math.max(1,imp-1);
  var total=imp*0.5+feas*0.25+ready*0.25;
  var ov=(OV[ind]||{})[o.id]||{};
  return {o:o,t:ov.t||o.t,b:ov.b||o.b,imp:imp,feas:feas,ready:ready,total:total,why:m,have:have};
}
var LABELS={staff:'staffing',admin:'administrative workload',cost:'operating costs',acquire:'winning customers',response:'response times',visibility:'visibility',growth:'growth',security:'security',entry:'duplicate data entry',sched:'scheduling',comms:'customer communication',report:'reporting',coord:'coordination',docs:'documents',inventory:'inventory',invoice:'invoicing',marketing:'promotions',time:'time back',revenue:'more business',scale:'scaling',traffic:'customer traffic',fnb:'F&B profitability',event:'event profitability',efficiency:'efficiency',repeat:'repeat visits',reporting:'reporting',waste:'food waste',scheduling:'scheduling',staffing:'staffing',slow:'slow nights'};
function LAB(v){return LABELS[v]||v;}
function optLabel(qid,v){ var qs=questions(); for(var i=0;i<qs.length;i++){ if(qs[i].id===qid){ var o=qs[i].opts.filter(function(x){return x[0]===v;})[0]; return o?o[1]:v; } } if(qid==='ready'){ var r=READY.filter(function(x){return x[0]===v;})[0]; return r?r[1]:v; } return v; }

function build(){
  var t=tags(), ind=effInd(), H=S.ind==='hospitality';
  var scored=OPP.map(function(o){return score(o,t,ind);}).sort(function(a,b){return b.total-a.total;});
  function top(tier){ return scored.filter(function(s){return s.o.tier===tier && (!s.o.foundation||t.limited);})[0]; }
  var quick=top('quick'), integ=top('integ'), long=t.limited? scored.filter(function(s){return s.o.id==='l_found';})[0] : top('long');
  if(H){ // ensure the hospitality signature recommendations appear when relevant
    var mk=scored.filter(function(s){return s.o.id==='q_mkt';})[0]; if(any(t.ts,['marketing'])||any(t.o,['traffic','event','repeat'])) quick=mk;
    var pf=scored.filter(function(s){return s.o.id==='i_profit';})[0]; if(any(t.o,['event','fnb','visibility'])||S.fu==='event') integ=pf;
    if(!t.limited) long=scored.filter(function(s){return s.o.id==='l_ops';})[0];
  }
  // facts
  var facts=[];
  var qs=questions();
  qs.forEach(function(q){ var v=S.a[q.id]; if(!v||(Array.isArray(v)&&!v.length)) return; var txt=Array.isArray(v)?v.map(function(x){return optLabel(q.id,x);}).join(', '):optLabel(q.id,v); facts.push([q.title.replace(/\?$/,''),txt]); });
  if(S.a.ready) facts.push(['Investment readiness',optLabel('ready',S.a.ready)]);
  if(S.fu&&S.fuA){ var fo=FU[S.fu].opts.filter(function(x){return x[0]===S.fuA;})[0]; facts.push([FU[S.fu].title.length>90?'Follow-up':FU[S.fu].title.replace(/\?$/,''),fo?fo[1]:S.fuA]); }

  // 1 primary challenge
  var pc;
  if(H){ var opsL=(S.a.ops||[]).map(function(x){return optLabel('ops',x).toLowerCase();}); var impv=S.a.improve; var imps=Array.isArray(impv)?impv:(impv?[impv]:[]); var impTxt=imps.map(function(x){return optLabel('improve',x).toLowerCase();}).join(', '); pc= opsL.length? 'You identified '+opsL.slice(0,3).join(', ')+(opsL.length>3?' and more':'')+' as the biggest operational problems, with '+impTxt+' as the improvement'+(imps.length>1?'s':'')+' that matter most.' : 'You told us '+impTxt+' matter'+(imps.length>1?'':'s')+' most.'; }
  else { var fr=S.a.frustration, oc=S.a.outcome; var frs=Array.isArray(fr)?fr:(fr?[fr]:[]); var ocs=Array.isArray(oc)?oc:(oc?[oc]:[]); var frTxt=frs.map(function(x){return optLabel('frustration',x).toLowerCase();}).join(', '); var ocTxt=ocs.map(function(x){return optLabel('outcome',x).toLowerCase();}).join(', '); pc='You told us your biggest frustration'+(frs.length>1?'s are':' is')+' <b>'+esc(frTxt)+'</b>, and the result'+(ocs.length>1?'s that would matter most are':' that would matter most is')+' <b>'+esc(ocTxt)+'</b>.'; }
  if(S.a.frustration_text) pc+=' In your words: \u201c'+esc(S.a.frustration_text)+'\u201d';

  // 2 hidden inefficiency (inferred)
  var hid=[];
  var sysCount=t.tech.filter(function(x){return x!=='limited'&&x!=='sheets';}).length;
  if(has(t.ts,'entry') && sysCount>=2) hid.push('With '+sysCount+' separate systems and time lost to re-typing data, the applications are probably not integrated \u2014 the same customer, order or time information may be entered more than once.');
  else if(has(t.ts,'entry')) hid.push('Time lost to re-typing data often points to information living in spreadsheets, inboxes and paper rather than one source of truth.');
  if(has(t.ts,'comms')||has(t.f,'response')) hid.push('Routine questions likely depend on whoever is free at the moment, so response time rises exactly when you are busiest.'+(S.fuA==='missed'?' You confirmed some inquiries get missed.':''));
  if(has(t.f,'staff')) hid.push('Before adding headcount, it\u2019s worth checking how much of the workload is administrative work that could be reduced.'+(S.fuA==='25_50'||S.fuA==='gt50'?' You estimated a significant share of the week goes to admin.':''));
  if(H && S.fu==='event' && S.fuA!=='all') hid.push('Event, entertainment and promotion spending is probably not tied back to sales and return visits, so it\u2019s hard to know which ones pay off.');
  if((has(t.f,'visibility')||has(t.o,'visibility')) && !has(t.tech,'acct') && !has(t.tech,'pos')) hid.push('Without accounting or POS data in one place, performance reporting probably relies on manual spreadsheets.');
  if(!hid.length) hid.push('Based on your answers, the biggest hidden cost is likely the manual coordination between steps \u2014 the handoffs nobody owns. A short discovery conversation would confirm or rule this out.');

  // 6 data & infrastructure
  var di=[];
  if(t.limited) di.push('You indicated a limited technology foundation. NetArmored would typically start with the essentials \u2014 reliable connectivity, business accounts with proper identity and access, organized data and backups \u2014 before advanced AI.');
  if(has(t.tech,'sheets')) di.push('Spreadsheets are a common starting point; key ones may need cleanup or a structured home before they can feed automation reliably.');
  if(sysCount>=2) di.push('Integration depends on whether your current applications offer APIs or exports \u2014 something to verify vendor by vendor.');
  if(has(t.tech,'network')) di.push('An existing on-premises network may make private or hybrid AI options practical for sensitive workloads.');
  if(H && has(t.tech,'gamingvendor')) di.push('Gaming-provider data and systems are governed by vendor agreements and regulation; NetArmored would not connect to them without proper authorization.');
  if(!di.length) di.push('Your existing tools look like a workable starting point. A readiness review would check data quality, access permissions and integration options.');

  // 7 security & governance gates
  var g=['Customer and employee data: collect only what\u2019s needed, restrict access by role, and keep audit logs.','Human approval before any AI-generated message, promotion or financial action goes out.'];
  if(H){ g.push('Gaming promotions and any gaming-adjacent integration require review of applicable Nevada regulations, venue licensing arrangements, vendor permissions and approved operator procedures. No changes to gaming systems, payouts, giveaway eligibility or regulated promotion rules.'); g.push('Alcohol promotions and customer messaging follow applicable advertising and consent rules.'); }
  if(ind==='healthcare') g.push('Health information requires a HIPAA-appropriate review, vendor agreements and access controls. AI supports administrative work only and never makes clinical decisions.');
  if(any(t.tech,['acct'])) g.push('Financial systems: least-privilege, read-only access wherever possible.');
  if(has(t.f,'security')) g.push('You flagged security concerns \u2014 a risk assessment would come before any new AI tooling.');
  g.push('Third-party AI services: review data-handling terms; no training on your business data without explicit authorization.');

  // category + next step
  var cat = t.limited?'Infrastructure First': t.ready==='broad'?'Transformation Ready': t.ready==='pilot'?'Pilot Ready':'Exploring';
  var catD={ 'Infrastructure First':'Building the right foundation now makes every later step faster and safer.','Transformation Ready':'You\u2019re ready to look at connected, business-wide improvements.','Pilot Ready':'You have a defined problem and appetite for a focused first project.','Exploring':'You\u2019re learning what\u2019s possible \u2014 the right place to start.'}[cat];
  var next={ 'Infrastructure First':'Schedule a discovery consultation focused on your technology foundation. NetArmored would map what you have, what\u2019s missing, and a staged plan that leads to the opportunities above.','Transformation Ready':'Request a detailed assessment: NetArmored would map your workflows end to end, validate the integration opportunity, and outline a phased roadmap with security gates.','Pilot Ready':'Discuss implementation priorities for the quick win below as a limited pilot \u2014 defined scope, measurable before-and-after, and a clear go/no-go decision.','Exploring':'Book a 15-minute guided discovery conversation to validate these observations and see which opportunity is worth measuring first.'}[cat];

  return {t:t,ind:ind,H:H,facts:facts,pc:pc,hid:hid,quick:quick,integ:integ,long:long,di:di,g:g,cat:cat,catD:catD,next:next,name:(S.a.estname||S.a.bizname||'').trim()};
}

/* ---------------- Rendering ---------------- */
var body=root.querySelector('.scan-body'), progEl=root.querySelector('.prog span'), dotsEl=root.querySelector('.dots'), lblEl=root.querySelector('.scan-top .lbl'), live=document.getElementById('scan-live');
function setTop(i,total){ var p=i<0?0:Math.min(100,((i)/total)*100); progEl.style.width=p+'%'; dotsEl.innerHTML=''; for(var k=0;k<total;k++){ var e=document.createElement('i'); if(k<i) e.className='done'; else if(k===i) e.className='cur'; dotsEl.appendChild(e);} }
function announce(s){ if(live){ live.textContent=''; setTimeout(function(){live.textContent=s;},30);} }
function focusTitle(){ var h=body.querySelector('.qtitle,h2'); if(h){ h.setAttribute('tabindex','-1'); h.focus({preventScroll:true}); } var top=root.getBoundingClientRect().top+window.scrollY-90; if(window.scrollY>top) window.scrollTo({top:top,behavior:RM?'auto':'smooth'}); }

function renderTrack(){
  lblEl.textContent='Choose your scan'; setTop(-1,5);
  var keys=['general','hospitality','retail','professional','logistics','home','healthcare','restaurant'];
  var desc={general:'Works for any business',hospitality:'Bars, restaurants, gaming & live entertainment',retail:'Stores, inventory, customer retention',professional:'Documents, onboarding, CRM, reporting',logistics:'Dispatch, routing, documentation',home:'Requests, dispatch, estimates, invoicing',healthcare:'Administrative workflows only',restaurant:'Food cost, ordering, staffing'};
  body.innerHTML='<div class="qwrap"><p class="qnum">Before we begin</p><h2 class="qtitle">Which scan fits your business?</h2><p class="qhelp">Every scan uses the same five-question structure, with examples and recommendations adapted to the industry.</p><div class="track-pick" role="radiogroup" aria-label="Scan type">'+keys.map(function(k){return '<label class="ans"><input type="radio" name="track" value="'+k+'"'+(S.ind===k?' checked':'')+'><span class="box" aria-hidden="true"></span><span><b>'+esc(IND[k].name)+(k==='hospitality'?' \u2605':'')+'</b><span class="d">'+esc(desc[k])+'</span></span></label>';}).join('')+'</div><p class="err" id="err-track" role="alert">Please choose a scan to continue.</p><div class="scan-nav"><span></span><button type="button" class="btn btn-p" data-act="begin">Begin scan <span class="arr" aria-hidden="true">\u2192</span></button></div></div>';
  body.querySelector('[data-act=begin]').addEventListener('click',function(){ var c=body.querySelector('input[name=track]:checked'); if(!c){ var e=document.getElementById('err-track'); e.classList.add('on'); body.querySelector('input[name=track]').focus(); return;} if(c.value!==S.ind){ S.a={}; S.fu=null; S.fuA=null; } S.ind=c.value; S.step=0; S.dir=1; render(); });
}

function renderQ(){
  var qs=questions(), q=qs[S.step], total=5, n=S.step+1;
  lblEl.textContent=(S.ind==='hospitality'?'Hospitality scan':IND[S.ind].name+' scan')+' \u00b7 '+n+' of '+total; setTop(S.step,total);
  var cur=S.a[q.id], multi=q.type==='multi';
  var h='<div class="qwrap'+(S.dir<0?' back':'')+'"><p class="qnum">'+(S.ind==='hospitality'?'Discovery \u2014 ':'')+'Question '+n+' of '+total+'</p><h2 class="qtitle" id="qt">'+esc(q.title)+'</h2><p class="qhelp">'+esc(q.help&&q.help.indexOf('Discovery')===0?'Pick the closest fit.':q.help||'')+'</p>';
  h+='<div class="answers" role="'+(multi?'group':'radiogroup')+'" aria-labelledby="qt">';
  q.opts.forEach(function(o){ var on=multi?has(cur||[],o[0]):cur===o[0]; h+='<label class="ans'+(multi?' multi':'')+'"><input type="'+(multi?'checkbox':'radio')+'" name="q" value="'+o[0]+'"'+(on?' checked':'')+'><span class="box" aria-hidden="true"></span><span><b>'+esc(o[1])+'</b>'+(o[2]?'<span class="d">'+esc(o[2])+'</span>':'')+'</span></label>'; });
  h+='</div><p class="err" id="err-q" role="alert">'+(multi?'Select at least one option.':'Please choose an option.')+'</p>';
  if(q.readiness){ h+='<div class="field"><span class="flabel" id="rl">Where are you on investing in improvements?</span><div class="answers" role="radiogroup" aria-labelledby="rl">'+READY.map(function(r){return '<label class="ans"><input type="radio" name="ready" value="'+r[0]+'"'+(S.a.ready===r[0]?' checked':'')+'><span class="box" aria-hidden="true"></span><span><b>'+esc(r[1])+'</b></span></label>';}).join('')+'</div><p class="err" id="err-r" role="alert">Please choose where you are on investing.</p></div>'; }
  (q.extra||[]).forEach(function(x){ h+='<div class="field"><label for="x-'+x[0]+'">'+esc(x[1])+'<span class="opt-l">'+esc(x[2])+'</span></label><input type="text" id="x-'+x[0]+'" maxlength="120" autocomplete="off" value="'+esc(S.a[x[0]]||'')+'"></div>'; });
  if(q.text){ h+='<div class="field"><label for="x-text">'+esc(q.text)+'</label><textarea id="x-text" maxlength="500">'+esc(S.a[q.id+'_text']||'')+'</textarea></div>'; }
  if(q.id==='systems'||q.id==='tech') h+='<p class="small muted" style="margin-top:14px">Please don\u2019t enter passwords, account numbers, customer records'+(S.ind==='hospitality'?', patron gambling history or gaming-system details':'')+'.</p>';
  h+='<div class="scan-nav"><button type="button" class="btn btn-g" data-act="back"><span aria-hidden="true">\u2190</span> Back</button><button type="button" class="btn btn-p" data-act="next">'+(n===total?'Continue':'Next')+' <span class="arr" aria-hidden="true">\u2192</span></button></div></div>';
  body.innerHTML=h;
  if(q.exclusive){ body.querySelectorAll('input[name=q]').forEach(function(i){ i.addEventListener('change',function(){ if(!i.checked) return; body.querySelectorAll('input[name=q]').forEach(function(j){ if(i.value===q.exclusive && j!==i) j.checked=false; if(i.value!==q.exclusive && j.value===q.exclusive) j.checked=false; }); }); }); }
  if(!multi && !q.readiness && !q.extra && !q.text){ body.querySelectorAll('input[name=q]').forEach(function(i){ i.addEventListener('change',function(){ setTimeout(next, RM?0:240); }); }); }
  body.querySelector('[data-act=back]').addEventListener('click',function(){ save(q); S.dir=-1; if(S.step===0){ S.step=-1; } else S.step--; render(); });
  body.querySelector('[data-act=next]').addEventListener('click',next);
  function next(){ if(!save(q,true)) return; S.dir=1; if(S.step<total-1){ S.step++; render(); } else { S.fu=pickFollowUp(); if(S.fu){ S.step='fu'; render(); } else finish(); } }
}
function save(q,validate){
  var multi=q.type==='multi', ins=[].slice.call(body.querySelectorAll('input[name=q]:checked')).map(function(i){return i.value;});
  S.a[q.id]=multi?ins:(ins[0]||null);
  (q.extra||[]).forEach(function(x){ var el=document.getElementById('x-'+x[0]); if(el) S.a[x[0]]=el.value.trim().slice(0,120); });
  var tx=document.getElementById('x-text'); if(tx) S.a[q.id+'_text']=tx.value.trim().slice(0,500);
  var r=body.querySelector('input[name=ready]:checked'); if(q.readiness) S.a.ready=r?r.value:S.a.ready;
  if(!validate) return true;
  var ok=true, e=document.getElementById('err-q');
  if(!ins.length){ e.classList.add('on'); body.querySelector('input[name=q]').focus(); ok=false; } else e.classList.remove('on');
  if(ok && q.readiness && !r){ var er=document.getElementById('err-r'); er.classList.add('on'); body.querySelector('input[name=ready]').focus(); ok=false; }
  return ok;
}
function renderFU(){
  var f=FU[S.fu]; lblEl.textContent='One clarifying question'; setTop(5,5);
  body.innerHTML='<div class="qwrap"><div class="followup" style="margin-top:0"><span class="tag">'+esc(f.tag)+'</span><h2 class="qtitle" id="fq">'+esc(f.title)+'</h2><p class="qhelp" style="margin-bottom:16px">Optional \u2014 it sharpens your snapshot. We only ask the single question most likely to change the recommendation.</p><div class="answers" role="radiogroup" aria-labelledby="fq">'+f.opts.map(function(o){return '<label class="ans"><input type="radio" name="fu" value="'+o[0]+'"'+(S.fuA===o[0]?' checked':'')+'><span class="box" aria-hidden="true"></span><span><b>'+esc(o[1])+'</b></span></label>';}).join('')+'</div></div><div class="scan-nav"><button type="button" class="btn btn-g" data-act="back"><span aria-hidden="true">\u2190</span> Back</button><span style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end"><button type="button" class="btn btn-g" data-act="skip">Skip</button><button type="button" class="btn btn-p" data-act="go">See my snapshot <span class="arr" aria-hidden="true">\u2192</span></button></span></div></div>';
  body.querySelector('[data-act=back]').addEventListener('click',function(){ S.dir=-1; S.step=4; render(); });
  body.querySelector('[data-act=skip]').addEventListener('click',function(){ S.fuA=null; finish(); });
  body.querySelector('[data-act=go]').addEventListener('click',function(){ var c=body.querySelector('input[name=fu]:checked'); S.fuA=c?c.value:null; finish(); });
}
function finish(){
  S.step='think'; lblEl.textContent='Building your snapshot'; setTop(5,5); progEl.style.width='100%';
  if(RM){ S.step='done'; render(); return; }
  var steps=['Reading your answers','Matching patterns to '+(S.ind==='hospitality'?'hospitality':IND[effInd()].name.toLowerCase())+' workflows','Ranking by impact, feasibility and readiness','Applying security and governance gates'];
  body.innerHTML='<div class="thinking" role="status"><div class="ring" aria-hidden="true"></div><ul>'+steps.map(function(s){return '<li>'+esc(s)+'</li>';}).join('')+'</ul><p class="small muted">Deterministic rules running in your browser \u2014 no AI service, nothing sent.</p></div>';
  var lis=body.querySelectorAll('li'), k=0; var iv=setInterval(function(){ if(k<lis.length){ lis[k].classList.add('ok'); lis[k].textContent='\u2713 '+lis[k].textContent; k++; } else { clearInterval(iv); S.step='done'; render(); } },380);
}
function bar(v){ return '<div class="m"><i style="width:'+Math.round(v/5*100)+'%"></i></div>'; }
function oppHTML(s,label){
  if(!s) return '';
  var why=s.why.length? 'Recommended because of '+s.why.slice(0,3).map(esc).join(', ')+'.' : 'Recommended as a broadly useful starting point given your answers.';
  if(s.have.length) why+=' You already use '+s.have.map(function(x){return LAB2(x);}).join(', ')+', which helps readiness.';
  return '<div class="opp"><div class="opp-top"><b>'+esc(s.t)+'</b><span class="tier">'+esc(label)+'</span></div><p style="margin:8px 0 0">'+esc(s.b)+'</p><div class="scores"><div class="score"><span>Business impact</span>'+bar(s.imp)+'</div><div class="score"><span>Feasibility</span>'+bar(s.feas)+'</div><div class="score"><span>Data readiness</span>'+bar(s.ready)+'</div></div><p class="why"><b>Why:</b> '+why+' <span class="src inf">Inferred</span></p><p class="gate">Security &amp; compliance review is a separate approval gate before implementation.</p></div>';
}
var TL={sheets:'spreadsheets',email:'email',acct:'accounting software',pos:'a POS',crm:'a CRM',schedsw:'scheduling software',industry:'industry software',cloud:'cloud storage',network:'your own network',inventorysw:'inventory software',marketingsw:'marketing tools',gamingvendor:'a gaming provider'};
function LAB2(x){return esc(TL[x]||x);}
function renderDone(){
  var R=build(); S.result=R; lblEl.textContent='Your Opportunity Snapshot'; dotsEl.innerHTML=''; progEl.style.width='100%';
  var title=R.name? esc(R.name)+' \u2014 AI Opportunity Snapshot':'Your AI Opportunity Snapshot';
  var h='<div class="qwrap" id="snapshot"><div class="snap-head"><div><p class="qnum">NetArmored \u00b7 Preliminary \u00b7 '+esc(R.H?'Las Vegas hospitality':IND[R.ind].name)+'</p><h2 class="qtitle">'+title+'</h2></div><span class="badge">Starting point: '+esc(R.cat)+'</span></div>';
  h+='<p class="qhelp">'+esc(R.catD)+' This snapshot is generated by transparent rules from your answers. It is a starting point for a conversation, not an assessment of your business.</p>';
  h+='<div class="legend"><span><span class="src fact">You told us</span> facts you provided</span><span><span class="src inf">Inferred</span> possibilities to validate</span></div>';
  var secs=[
   ['Primary operational challenge','<p>'+R.pc+' <span class="src fact">You told us</span></p>'],
   ['Likely hidden inefficiency',R.hid.map(function(x){return '<p>'+esc(x)+' <span class="src inf">Inferred</span></p>';}).join('')],
   ['Recommended quick win',oppHTML(R.quick,'Quick win')],
   ['Potential integration opportunity',oppHTML(R.integ,'Business integration')],
   ['Longer-term transformation opportunity',oppHTML(R.long,'Long-term')],
   ['Data and infrastructure considerations',R.di.map(function(x){return '<p>'+esc(x)+' <span class="src inf">Inferred</span></p>';}).join('')],
   ['Security and governance considerations',R.g.map(function(x){return '<p class="gate" style="color:#C9D6E6">'+esc(x)+'</p>';}).join('')],
   ['Suggested next step','<p>'+esc(R.next)+'</p>']
  ];
  secs.forEach(function(s,i){ h+='<div class="snap-sec"><span class="sn">0'+(i+1)+'</span><div><h3>'+esc(s[0])+'</h3>'+s[1]+'</div></div>'; });
  h+='<details class="assume"><summary>Your answers (what this snapshot is based on)</summary><ul>'+R.facts.map(function(f){return '<li><b>'+esc(f[0])+':</b> '+esc(f[1])+'</li>';}).join('')+(S.a.revdetail?'<li><b>Revenue details:</b> '+esc(S.a.revdetail)+'</li>':'')+(S.a.q1_text?'<li><b>Details:</b> '+esc(S.a.q1_text)+'</li>':'')+'</ul></details>';
  h+='<div class="snap-actions"><button type="button" class="btn btn-p" data-act="dl">Download my snapshot</button><button type="button" class="btn btn-g" data-act="print">Print / save as PDF</button><a class="btn btn-g" href="/contact/?source=scan-detailed-assessment">Request a detailed assessment</a><a class="btn btn-g" href="/contact/?source=scan-consultation">Schedule a discovery consultation</a><a class="btn btn-g" href="/contact/?source=scan-implementation">Discuss implementation priorities</a><button type="button" class="btn btn-g" data-act="restart">Start over</button></div>';
  h+='<p class="disclaim">Preliminary and illustrative. Recommendations come from deterministic rules applied to your answers; they are not a guarantee of results, cost or feasibility, and NetArmored has not reviewed your business. Your answers stayed in this browser tab: nothing was stored or sent. Downloading saves a file to your device only.</p></div>';
  body.innerHTML=h;
  body.querySelector('[data-act=dl]').addEventListener('click',download);
  body.querySelector('[data-act=print]').addEventListener('click',function(){ window.print(); });
  body.querySelector('[data-act=restart]').addEventListener('click',function(){ S={ind:S.ind,step:-1,a:{},fu:null,fuA:null,dir:-1}; render(); });
  announce('Your Opportunity Snapshot is ready.');
}
function download(){
  var el=document.getElementById('snapshot').cloneNode(true); var a=el.querySelector('.snap-actions'); if(a) a.remove();
  el.querySelectorAll('details').forEach(function(d){d.setAttribute('open','');});
  var css='body{font:15px/1.6 -apple-system,Segoe UI,Inter,sans-serif;color:#1b2738;max-width:820px;margin:40px auto;padding:0 24px}h2,h3,b{color:#0B1424}h2{font-size:26px}.qnum{font:12px monospace;letter-spacing:.1em;text-transform:uppercase;color:#377DFF}.badge{display:inline-block;border:1px solid #2DD4BF;border-radius:99px;padding:4px 10px;font-size:13px}.snap-sec{border-top:1px solid #dde4ee;padding:14px 0;display:grid;grid-template-columns:40px 1fr}.sn{color:#2DD4BF;font:600 13px monospace}.src{font:10px monospace;text-transform:uppercase;padding:2px 5px;border-radius:3px;background:#eef3fb;color:#377DFF;margin-left:4px}.src.fact{background:#eef0f3;color:#333}.opp{border:1px solid #dde4ee;border-radius:10px;padding:12px;margin-top:8px}.scores{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:8px 0}.score span{font:10px monospace;text-transform:uppercase;color:#667}.m{height:6px;background:#eef1f5;border-radius:6px}.m i{display:block;height:6px;border-radius:6px;background:linear-gradient(90deg,#377DFF,#2DD4BF)}.tier{font:11px monospace;text-transform:uppercase;color:#2DD4BF;margin-left:8px}.gate{color:#8a5a00}.legend{font-size:12px;color:#556}.disclaim,.why,.qhelp{color:#556;font-size:13px}';
  var html='<!doctype html><html lang="en"><head><meta charset="utf-8"><title>NetArmored AI Opportunity Snapshot</title><meta name="robots" content="noindex"><style>'+css+'</style></head><body><p class="qnum">NetArmored \u2014 Transform Your Business. Secure Your Future.</p>'+el.innerHTML+'<p class="disclaim">Generated '+new Date().toLocaleString()+' from a concept preview. Illustrative only.</p></body></html>';
  var blob=new Blob([html],{type:'text/html'}); var u=URL.createObjectURL(blob); var l=document.createElement('a'); l.href=u; l.download='NetArmored-AI-Opportunity-Snapshot.html'; document.body.appendChild(l); l.click(); setTimeout(function(){URL.revokeObjectURL(u); l.remove();},500);
}
var first=true;
function render(){
  if(S.step===-1) renderTrack(); else if(S.step==='fu') renderFU(); else if(S.step==='done') renderDone(); else if(typeof S.step==='number') renderQ();
  if(S.step!=='think' && !first) focusTitle();
  first=false;
}
render();
window.__naScan={S:S,build:build}; // for automated testing only
})();
