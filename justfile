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
      <title>x</title>
      <style>
        body { max-width: 40rem; margin: 4rem auto; padding: 0 1rem; font: 1rem/1.6 system-ui, sans-serif; }
        a { color: inherit; }
        li { margin: .5rem 0; }
      </style>
    </head>
    <body>
      <main>
        <h1>x</h1>
        <ul>
    EOF
        for page in */index.html; do
            [ -f "$page" ] || continue
            project=${page%/index.html}
            printf '      <li><a href="%s/">%s</a></li>\n' "$project" "$project"
        done
        cat <<'EOF'
        </ul>
      </main>
    </body>
    </html>
    EOF
    } > index.html

    printf 'Generated index.html\n'
