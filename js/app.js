window.WPulseTools = [];
window.registerTool = function(tool) {
  window.WPulseTools.push(tool);
};

if (document.documentElement.getAttribute('data-theme') === 'dark') {
  document.getElementById('themeToggle').textContent = '☀️';
}
function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  if (current === 'dark') {
    document.documentElement.removeAttribute('data-theme');
    localStorage.setItem('wpulse-theme', 'light');
    document.getElementById('themeToggle').textContent = '🌙';
  } else {
    document.documentElement.setAttribute('data-theme', 'dark');
    localStorage.setItem('wpulse-theme', 'dark');
    document.getElementById('themeToggle').textContent = '☀️';
  }
}

function showView(view) {
  document.getElementById('viewInput').style.display = view === 'hero' ? '' : 'none';
  document.getElementById('viewInputPanel').style.display = view === 'input' ? '' : 'none';
  document.getElementById('viewDashboard').style.display = view === 'dashboard' && window.LAST_DATA ? '' : 'none';

  if (view === 'dashboard' && !window.LAST_DATA) {
    document.getElementById('viewInput').style.display = '';
    view = 'hero';
  }

  const backBtn = document.getElementById('floatingBackBtn');
  if (backBtn) backBtn.style.display = view === 'hero' ? 'none' : 'flex';

  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
  if (view === 'hero') { const el = document.getElementById('navHome'); if(el) el.classList.add('active'); }
  if (view === 'dashboard') { const el = document.getElementById('navDashboard'); if(el) el.classList.add('active'); }
  if (view === 'input') { const el = document.getElementById('navInput'); if(el) el.classList.add('active'); }
}

window.goBackBtnClicked = function() {
  if (document.getElementById('viewDashboard').style.display !== 'none') {
    showView('input');
  } else {
    showView('hero');
  }
};

function renderToolGrid() {
  const grid = document.getElementById('toolGrid');
  if (!grid) return;
  grid.innerHTML = window.WPulseTools.map(t => `
    <div class="tool-card" onclick="selectTool('${t.id}')">
      <div class="tool-card-icon">${t.icon || '🛠️'}</div>
      <div class="tool-card-title">${esc(t.name)}</div>
      <div class="tool-card-desc">${esc(t.description || '')}</div>
    </div>
  `).join('');
}

window.selectTool = function(id) {
  const t = window.WPulseTools.find(x => x.id === id);
  if (!t) return;
  window.ACTIVE_TOOL = t;
  document.getElementById('inputPanelTitle').textContent = `Paste ${t.name} Output`;
  document.getElementById('raw').placeholder = t.placeholder || 'Paste your output here...';
  
  const btn = document.getElementById('loadExampleBtn');
  if (btn) btn.style.display = (t.exampleFile || t.exampleText) ? 'inline-flex' : 'none';
  
  showView('input');
  setTimeout(() => document.getElementById('raw').focus(), 100);
};

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
    return `<div class="hist-item" onclick="loadHistoryItem(${i})"><div class="hist-item-url">${esc(e.target)}</div><div class="hist-item-meta">${e.badges||''}<span class="hist-time">${e.date} ${e.time}</span></div></div>`;
  }).join('');
}

function loadHistoryItem(idx) {
  const entry = history_items[idx];
  if (!entry) return;
  const raw = sessionStorage.getItem('wpulse-'+entry.rawKey);
  if (!raw) { setStatus('Session expired — re-analyze'); return; }
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
  setStatus('Analyzing…');
  setTimeout(() => {
    try {
      let matchedTool = window.ACTIVE_TOOL;
      if (!matchedTool) {
        matchedTool = window.WPulseTools.find(t => t.match(raw));
        if (!matchedTool) throw new Error('Please select a tool first, or drop a recognized file.');
        window.ACTIVE_TOOL = matchedTool;
      }
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
      setStatus('Error — ' + err.message);
      console.error(err);
    }
  }, 60);
}

function loadExample() {
  const t = window.ACTIVE_TOOL;
  if (!t) return;
  if (t.exampleText) {
    document.getElementById('raw').value = t.exampleText;
    go();
    return;
  }
  if (t.exampleFile) {
    setStatus('Loading example…');
    fetch(t.exampleFile)
      .then(r => { if (!r.ok) throw new Error('Not found'); return r.text(); })
      .then(txt => { document.getElementById('raw').value = txt; go(); })
      .catch(() => setStatus('Could not load example file'));
  }
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

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => { renderHistoryList(); renderToolGrid(); });
} else {
  renderHistoryList(); renderToolGrid();
}

let globalSearchMatches = [];
let globalSearchCurrentIndex = -1;
let globalSearchLastTerm = '';

window.handleCustomGlobalSearch = function(e, val) {
  if (e.key === 'Enter') {
    executeGlobalSearch(val);
  }
};

function executeGlobalSearch(term) {
  const container = document.getElementById('mainContent');
  if (!container) return;

  term = term.trim().toLowerCase();
  if (!term) {
    removeHighlights(container);
    globalSearchMatches = [];
    globalSearchCurrentIndex = -1;
    globalSearchLastTerm = '';
    return;
  }

  if (term === globalSearchLastTerm && globalSearchMatches.length > 0) {
    if (!document.body.contains(globalSearchMatches[0])) {
      globalSearchLastTerm = '';
      return executeGlobalSearch(term);
    }
    globalSearchCurrentIndex = (globalSearchCurrentIndex + 1) % globalSearchMatches.length;
    scrollToMatch(globalSearchMatches[globalSearchCurrentIndex]);
    return;
  }

  removeHighlights(container);
  globalSearchMatches = [];
  globalSearchCurrentIndex = -1;
  globalSearchLastTerm = term;

  const walker = document.createTreeWalker(container, 4 /* NodeFilter.SHOW_TEXT */, null, false);
  const textNodes = [];
  let node;
  while (node = walker.nextNode()) {
    if (node.parentNode.nodeName !== 'SCRIPT' && node.parentNode.nodeName !== 'STYLE' && node.parentNode.nodeName !== 'NOSCRIPT' && !node.parentNode.classList.contains('global-highlight')) {
      textNodes.push(node);
    }
  }

  textNodes.forEach(textNode => {
    let currentTextNode = textNode;
    let text = currentTextNode.nodeValue;
    let lowerText = text.toLowerCase();
    let idx = lowerText.indexOf(term);

    while (idx !== -1) {
      const matchText = text.substr(idx, term.length);
      const mark = document.createElement('mark');
      mark.className = 'global-highlight';
      mark.style.backgroundColor = '#ffeb3b';
      mark.style.color = '#000';
      mark.style.padding = '0 2px';
      mark.style.borderRadius = '2px';
      mark.textContent = matchText;

      const after = currentTextNode.splitText(idx);
      after.nodeValue = after.nodeValue.substr(term.length);
      currentTextNode.parentNode.insertBefore(mark, after);

      globalSearchMatches.push(mark);

      let parent = mark.parentElement;
      while (parent && parent !== container) {
        if (parent.style && parent.style.display === 'none') {
          parent.style.display = 'block';
        }
        if (parent.classList && parent.classList.contains('plugin-body') && !parent.classList.contains('open')) {
          parent.classList.add('open');
        }
        if (parent.classList && parent.classList.contains('sec-body') && !parent.classList.contains('open')) {
          parent.classList.add('open');
          if (parent.id && parent.id.endsWith('Body')) {
            const cid = parent.id.replace('Body', 'Chev');
            const chevron = document.getElementById(cid);
            if (chevron) chevron.classList.add('open');
          }
        }
        parent = parent.parentElement;
      }

      currentTextNode = after;
      text = currentTextNode.nodeValue;
      lowerText = text.toLowerCase();
      idx = lowerText.indexOf(term);
    }
  });

  if (globalSearchMatches.length > 0) {
    globalSearchCurrentIndex = 0;
    scrollToMatch(globalSearchMatches[0]);
  }
}

function scrollToMatch(mark) {
  document.querySelectorAll('.global-highlight').forEach(m => {
    m.style.backgroundColor = '#ffeb3b';
    m.style.color = '#000';
    m.style.boxShadow = 'none';
  });
  mark.style.backgroundColor = 'var(--accent)';
  mark.style.color = '#fff';
  mark.style.boxShadow = '0 0 0 2px var(--accent-bd)';
  mark.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function removeHighlights(container) {
  const marks = container.querySelectorAll('mark.global-highlight');
  marks.forEach(mark => {
    const parent = mark.parentNode;
    parent.replaceChild(document.createTextNode(mark.textContent), mark);
    parent.normalize();
  });
}
