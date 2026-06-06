# WPulse

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

## Usage

1. Open the page
2. Paste WPScan output or click "Load Example"
3. Browse the vulnerability dashboard

## Deploy to GitHub Pages

1. Push this repo to GitHub
2. Go to Settings → Pages
3. Set Source to `main` branch, `/ (root)` directory
4. Site will be live at `https://<username>.github.io/wpulse/`

## Files

```
index.html          — Full application (HTML + CSS + JS)
example-input.txt   — Sample WPScan output for demo
```

## License

MIT
