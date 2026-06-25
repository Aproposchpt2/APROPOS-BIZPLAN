// Apropos Business Center — shared front-end helpers (loaded on every page).
// Pure utilities only: no element lookups at load, so it is safe on any page.
const $ = id => document.getElementById(id);

function escapeHtml(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}

function mdToHtml(md){const lines=String(md||'').split('\n');let html='',inList=false;const inline=s=>escapeHtml(s).replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>');for(const raw of lines){const line=raw.trim();if(/^##\s+/.test(line)){if(inList){html+='</ul>';inList=false}html+='<h2>'+inline(line.replace(/^##\s+/,''))+'</h2>';continue}if(/^[-*]\s+/.test(line)){if(!inList){html+='<ul>';inList=true}html+='<li>'+inline(line.replace(/^[-*]\s+/,''))+'</li>';continue}if(line===''){if(inList){html+='</ul>';inList=false}continue}if(inList){html+='</ul>';inList=false}html+='<p>'+inline(line)+'</p>'}if(inList)html+='</ul>';return html;}

function mdInline(s){return escapeHtml(s).replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>').replace(/\n/g,'<br>');}

// Session store — carries the member's profile/context between pages.
const Store = {
  get(k){try{return JSON.parse(sessionStorage.getItem(k));}catch(_){return null;}},
  set(k,v){try{sessionStorage.setItem(k,JSON.stringify(v));}catch(_){}},
  del(k){try{sessionStorage.removeItem(k);}catch(_){}}
};

// Map a recommended-service href onto the multi-page routes.
// Internal section anchors from the recommendation engine → real pages.
function resolveHref(href){
  const h=String(href||'');
  if(/^https?:|^mailto:/i.test(h))return h;
  if(h==='#assistant')return '/coach.html';
  if(h==='#documents')return '/documents.html';
  if(h==='#results'||h==='#start')return '/assessment.html';
  return h;
}
