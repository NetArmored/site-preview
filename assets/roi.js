/* NetArmored ROI Scenario Explorer — illustrative estimates only. Runs in the browser; nothing stored or sent. */
(function(){
'use strict';
var f=document.getElementById('roi'); if(!f) return;
var F=['people','hours','rate','volume','reduction','onetime','monthly','weeks'];
function v(n){ var el=f.querySelector('[name='+n+']'); var x=parseFloat(el.value); return isFinite(x)&&x>=0?x:0; }
function money(x){ return '$'+Math.round(x).toLocaleString(); }
function num(x,dp){ var m=Math.pow(10,dp||0); return (Math.round(x*m)/m).toLocaleString(); }
function sync(src){ var n=src.name||src.dataset.for; f.querySelectorAll('[name='+n+'],[data-for='+n+']').forEach(function(el){ if(el!==src) el.value=src.value; }); }
function calc(){
  var p=v('people'),h=v('hours'),r=v('rate'),vol=v('volume'),red=Math.min(90,v('reduction'))/100,one=v('onetime'),mo=v('monthly'),wk=Math.min(52,v('weeks'))||50;
  var burden=p*h, perItem=vol>0?burden*60/vol:0;
  var scen=[['Conservative',red*0.5],['Expected',red],['Optimistic',Math.min(.9,red*1.5)]];
  var rec=burden*red, val=rec*r, yrH=rec*wk, yrV=val*wk, opYr=mo*12;
  set('o-burden',num(burden,1)+' hrs/wk'); set('o-cost',money(burden*r)+'/wk'); set('o-per',vol>0?num(perItem,1)+' min':'—');
  set('o-rec',num(rec,1)); set('o-val',money(val)+'/wk'); set('o-yrh',num(yrH)+' hrs'); set('o-yrv',money(yrV));
  set('o-fte',num(yrH/(40*wk||1),2));
  var net=f.querySelector('#o-net'), pb=f.querySelector('#o-pb');
  if(one||mo){ net.textContent=money(yrV-opYr-one)+' (year 1)'; var mv=val*wk/12-mo; pb.textContent= mv>0? (one? num(one/mv,1)+' months':'Immediate'):'Not reached'; f.querySelector('#costrows').hidden=false; } else f.querySelector('#costrows').hidden=true;
  var max=Math.max(burden,1);
  var bars=f.querySelector('#bars'); bars.innerHTML='<div class="bar-r"><span>Current</span><span class="t"><i class="cur" style="width:100%"></i></span><b>'+num(burden,1)+' h</b></div>'+scen.map(function(s){var rh=burden*s[1]; return '<div class="bar-r"><span>'+s[0]+'</span><span class="t"><i style="width:'+(rh/max*100)+'%"></i></span><b>'+num(rh,1)+' h</b></div>';}).join('');
  set('o-range',num(burden*scen[0][1]*wk)+' – '+num(burden*scen[2][1]*wk)+' hrs/yr');
  f.querySelectorAll('output[data-show]').forEach(function(o){ o.textContent=f.querySelector('[name='+o.dataset.show+']').value; });
}
function set(id,t){ var e=f.querySelector('#'+id); if(e) e.textContent=t; }
f.addEventListener('input',function(e){ if(e.target.matches('input')){ sync(e.target); calc(); } });
f.addEventListener('submit',function(e){e.preventDefault();});
var P={hosp:{people:1,hours:10,rate:18,volume:50,reduction:50,onetime:0,monthly:0,weeks:50},office:{people:3,hours:8,rate:28,volume:120,reduction:35,onetime:0,monthly:0,weeks:48},field:{people:2,hours:10,rate:24,volume:60,reduction:30,onetime:0,monthly:0,weeks:50}};
document.querySelectorAll('[data-preset]').forEach(function(b){ b.addEventListener('click',function(){ var p=P[b.dataset.preset]; Object.keys(p).forEach(function(k){ f.querySelectorAll('[name='+k+'],[data-for='+k+']').forEach(function(el){el.value=p[k];}); }); calc(); }); });
calc();
})();
