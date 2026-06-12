window.WPulseTools = [];
window.registerTool = function(tool) {
  window.WPulseTools.push(tool);
};

if (document.documentElement.getAttribute('data-theme') === 'dark') {
  document.getElementById('themeToggle').textContent = 'â˜€ï¸';
}
function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  if (current === 'dark') {
    document.documentElement.removeAttribute('data-theme');
    localStorage.setItem('wpulse-theme', 'light');
    document.getElementById('themeToggle').textContent = 'ðŸŒ™';
  } else {
    document.documentElement.setAttribute('data-theme', 'dark');
    localStorage.setItem('wpulse-theme', 'dark');
    document.getElementById('themeToggle').textContent = 'â˜€ï¸';
  }
}

function showView(view) {
  document.getElementById('viewInput').style.display = view === 'hero' ? '' : 'none';
  document.getElementById('viewInputPanel').style.display = view === 'input' ? '' : 'none';
  document.getElementById('viewDashboard').style.display = view === 'dashboard' && window.LAST_DATA ? '' : 'none';

  if (view === 'dashboard' && !window.LAST_DATA) {
    document.getElementById('viewInput').style.display = '';
  }

  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
  if (view === 'dashboard' || view === 'hero') document.getElementById('navDashboard').classList.add('active');
  if (view === 'input') document.getElementById('navInput').classList.add('active');
}

function openInputPanel() {
  showView('input');
  setTimeout(() => document.getElementById('raw').focus(), 100);
}

let sidebarOpen = false;
function toggleSidebar() {
  sidebarOpen = !sidebarOpen;
  document.getElementById('sidebar').classList.toggle('collapsed', !sidebarOpen);
  document.getElementById('navHistory').classList.toggle('active', sidebarOpen);
}

const MAX_HISTORY = 25;
let history_items = JSON.parse(localStorage.getItem('wpulse-history') || '[]');
window.LAST_DATA = null;
window.ACTIVE_TOOL = null;

function saveHistory(data, title, badges) {
  const key = Date.now();
  const entry = { id:key, target: title, time: new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}), date: new Date().toLocaleDateString([],{month:'short',day:'numeric'}), badges: badges, rawKey:key, toolId: window.ACTIVE_TOOL.id };
  try { sessionStorage.setItem('wpulse-'+key, JSON.stringify(data)); } catch(e) {}
  history_items.unshift(entry);
  if (history_items.length > MAX_HISTORY) history_items.pop();
  try { localStorage.setItem('wpulse-history', JSON.stringify(history_items)); } catch(e) {}
  renderHistoryList();
  if (!sidebarOpen) toggleSidebar();
}

function renderHistoryList() {
  const list = document.getElementById('histList');
  if (!history_items.length) { list.innerHTML = '<div class="hist-empty">No scans yet.<br>Analyze output to see history.</div>'; return; }
  list.innerHTML = history_items.map((e,i) => {
    return \`<div class="hist-item" onclick="loadHistoryItem(\${i})"><div class="hist-item-url">\${esc(e.target)}</div><div class="hist-item-meta">\${e.badges||''}<span class="hist-time">\${e.date} \${e.time}</span></div></div>\`;
  }).join('');
}

function loadHistoryItem(idx) {
  const entry = history_items[idx];
  if (!entry) return;
  const raw = sessionStorage.getItem('wpulse-'+entry.rawKey);
  if (!raw) { setStatus('Session expired â€” re-analyze'); return; }
  window.LAST_DATA = JSON.parse(raw);
  window.ACTIVE_TOOL = window.WPulseTools.find(t => t.id === entry.toolId);
  if (window.ACTIVE_TOOL && window.ACTIVE_TOOL.onLoadHistory) {
      window.ACTIVE_TOOL.onLoadHistory(window.LAST_DATA);
  } else if (window.ACTIVE_TOOL) {
      document.getElementById('viewDashboard').innerHTML = '<div class="dashboard">' + window.ACTIVE_TOOL.render(window.LAST_DATA) + '</div>';
  }
  showView('dashboard');
  setStatus('Loaded: ' + entry.target);
}

function clearHistory() {
  history_items = [];
  localStorage.removeItem('wpulse-history');
  renderHistoryList();
}

function go() {
  const raw = document.getElementById('raw').value.trim();
  if (!raw) return;
  const btn = document.getElementById('analyzeBtn');
  btn.classList.add('loading');
  setStatus('Analyzingâ€¦');
  setTimeout(() => {
    try {
      let matchedTool = window.WPulseTools.find(t => t.match(raw));
      if (!matchedTool) throw new Error('No compatible tool found for this output.');
      
      window.ACTIVE_TOOL = matchedTool;
      const data = matchedTool.parse(raw);
      window.LAST_DATA = data;
      btn.classList.remove('loading');
      
      const html = matchedTool.render(data);
      document.getElementById('viewDashboard').innerHTML = '<div class="dashboard">' + html + '</div>';
      
      if (matchedTool.saveHistoryParams) {
          const params = matchedTool.saveHistoryParams(data);
          saveHistory(data, params.title, params.badges);
      } else {
          saveHistory(data, matchedTool.name + ' Scan', '');
      }
      
      showView('dashboard');
      if (matchedTool.getSummary) setStatus(matchedTool.getSummary(data));
      else setStatus('Analysis complete');
      
    } catch(err) {
      btn.classList.remove('loading');
      setStatus('Error â€” ' + err.message);
      console.error(err);
    }
  }, 60);
}

function loadExample() {
  setStatus('Loading exampleâ€¦');
  fetch('example-input.txt')
    .then(r => { if (!r.ok) throw new Error('Not found'); return r.text(); })
    .then(txt => { document.getElementById('raw').value = txt; showView('input'); go(); })
    .catch(() => setStatus('Could not load example file'));
}

function setStatus(msg) { document.getElementById('status-text').textContent = msg; }

;(function() {
  const ov = document.getElementById('dropOverlay');
  let dc = 0;
  document.addEventListener('dragenter', e => { e.preventDefault(); dc++; ov.classList.add('active'); });
  document.addEventListener('dragleave', e => { e.preventDefault(); dc--; if (dc<=0){dc=0;ov.classList.remove('active');} });
  document.addEventListener('dragover', e => e.preventDefault());
  document.addEventListener('drop', e => {
    e.preventDefault(); dc=0; ov.classList.remove('active');
    const file = e.dataTransfer.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { document.getElementById('raw').value = reader.result; go(); };
    reader.readAsText(file);
  });
})();

document.addEventListener('keydown', e => {
  if (e.ctrlKey && e.key === 'Enter') go();
});

function esc(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function tog(bid, cid) {
  const b = document.getElementById(bid), c = document.getElementById(cid);
  if (!b) return;
  b.classList.toggle('open'); if (c) c.classList.toggle('open');
}
function togP(pid) {
  const b = document.getElementById(pid); if (!b) return;
  b.classList.toggle('open');
}

window.addEventListener('DOMContentLoaded', () => renderHistoryList());
