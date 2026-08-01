default:
    #!/bin/sh
    set -eu

    {
        cat <<'EOF'
    <!doctype html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <meta name="description" content="An index of experiments, prototypes, and useful detours.">
      <meta name="theme-color" content="#090b0f">
      <title>x / index</title>
      <style>
        :root {
          color-scheme: dark;
          --bg: #090b0f;
          --panel: #0e1117;
          --ink: #e6edf3;
          --muted: #77808d;
          --line: #242a33;
          --accent: #8de4a8;
        }

        * { box-sizing: border-box; }
        body {
          min-height: 100vh;
          margin: 0;
          color: var(--ink);
          background: var(--bg);
          font: 14px/1.6 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        }

        main { width: min(640px, calc(100% - 40px)); margin: auto; padding: 56px 0 36px; }
        header { padding-bottom: 28px; border-bottom: 1px solid var(--line); }
        .path { margin: 0 0 14px; color: var(--accent); font-size: .7rem; letter-spacing: .08em; text-transform: uppercase; }
        .path::before { content: ""; display: inline-block; width: 7px; aspect-ratio: 1; margin-right: 10px; border-radius: 50%; background: var(--accent); box-shadow: 0 0 12px rgba(141,228,168,.7); }
        h1 { margin: 0; font-size: clamp(2.2rem, 7vw, 3.4rem); letter-spacing: -.06em; line-height: 1; }
        h1 span { color: var(--muted); font-weight: 400; }
        .intro { margin: 12px 0 0; color: var(--muted); }

        nav { margin-top: 30px; counter-reset: project; }
        .list-head { display: flex; justify-content: space-between; margin: 0 0 8px; color: var(--muted); font-size: .65rem; letter-spacing: .1em; text-transform: uppercase; }
        ul { margin: 0; padding: 0; border-top: 1px solid var(--line); list-style: none; }
        li { border-bottom: 1px solid var(--line); }
        a {
          display: grid;
          grid-template-columns: 2.75rem 1fr auto;
          gap: 12px;
          align-items: center;
          min-height: 54px;
          padding-right: 10px;
          color: inherit;
          text-decoration: none;
          transition: color .15s, background .15s, padding .15s;
        }
        a::before { counter-increment: project; content: counter(project, decimal-leading-zero); color: var(--muted); font-size: .72rem; }
        a::after { content: "↗"; color: var(--muted); transition: transform .15s; }
        a:hover, a:focus-visible { padding-left: 8px; color: var(--accent); background: var(--panel); outline: none; }
        a:hover::after, a:focus-visible::after { color: var(--accent); transform: translate(2px, -2px); }
        a:focus-visible { box-shadow: inset 3px 0 var(--accent); }

        footer { display: flex; justify-content: space-between; gap: 20px; margin-top: 30px; color: var(--muted); font-size: .65rem; }
        code { color: var(--accent); font: inherit; }

        @media (max-width: 520px) {
          main { width: min(100% - 28px, 640px); padding-top: 36px; }
          a { grid-template-columns: 2.25rem 1fr auto; gap: 8px; }
          footer { flex-direction: column; }
        }
      </style>
    </head>
    <body>
      <main>
        <header>
          <p class="path">~/Dev/x</p>
          <h1><span>Index of</span> /x</h1>
          <p class="intro">Experiments, prototypes, and other useful detours.</p>
        </header>
        <nav aria-label="Projects">
          <p class="list-head"><span>Projects</span><span>Open ↗</span></p>
          <ul>
    EOF
        for page in */index.html; do
            [ -f "$page" ] || continue
            project=${page%/index.html}
            printf '        <li><a href="%s/">%s</a></li>\n' "$project" "$project"
        done
        cat <<'EOF'
          </ul>
        </nav>
        <footer><span>x://index</span><span>generated with <code>just</code></span></footer>
      </main>
    </body>
    </html>
    EOF
    } > index.html

    printf 'Generated index.html\n'
