<div align="center">
  <img src="logo.png" alt="WPulse Logo" style="background: transparent;" width="175">
  
  <h1>WPulse</h1>
  
  <p>
    <img src="https://img.shields.io/badge/Language-JavaScript-yellow?style=flat&logo=javascript" alt="JS">
    <img src="https://img.shields.io/badge/Tool-WPScan-blue?style=flat&logo=shield" alt="WPScan">
    <img src="https://img.shields.io/badge/Category-Security-red?style=flat&logo=security" alt="Security">
  </p>
</div>
Browser-based WPScan output analyzer. Paste your scan results and get instant vulnerability dashboard with severity classification, CVE extraction, and advanced filtering.

**Live Demo:** https://infat0x.github.io/wpulse/

## Features

- Client-side parsing — no backend, no data leaves your browser
- Severity classification (Critical / High / Medium / Low)
- CVE extraction with direct links
- Filter by severity, plugin, fix status, auth level
- Search across titles, plugins, and CVEs
- Export to JSON / CSV
- Drag & drop file support
- Scan history (localStorage)

## Files

```
index.html          — Main HTML structure
css/main.css        — Design system and styling
js/app.js           — Core logic and tool registry
js/wpscan.js        — WPScan parser and UI
js/nmap.js          — Nmap parser and UI
example-input.txt   — Sample WPScan output for demo
```

## License

MIT
