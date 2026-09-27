#!/bin/bash
# Refuses any attempt by Claude to write to a .env file. The real secrets live
# there and the repo is public, so edits to it are Aereon's to make by hand.
# .env.example is allowed — it holds no secrets.
input=$(cat)
tool=$(jq -r '.tool_name // ""' <<<"$input")
env_re='(^|[/[:space:]"'"'"'])\.env(\.[A-Za-z0-9_-]+)?($|[[:space:]"'"'"';|&)])'
is_secret_env() { grep -Eq "$env_re" <<<"$1" && ! grep -Eq '\.env\.example' <<<"$1"; }

case "$tool" in
  Edit|Write|MultiEdit|NotebookEdit)
    path=$(jq -r '.tool_input.file_path // .tool_input.notebook_path // ""' <<<"$input")
    if is_secret_env "$path"; then
      echo "Blocked: $path holds secret keys. Aereon edits .env files by hand — tell them exactly what line to add or change instead." >&2
      exit 2
    fi ;;
  Bash)
    cmd=$(jq -r '.tool_input.command // ""' <<<"$input")
    # Only writes: redirects, tee, sed -i, cp/mv onto it, rm. Reading via
    # `node --env-file-if-exists=.env` (the npm scripts) is fine.
    if grep -Eq '(>>?[[:space:]]*|tee([[:space:]]+-a)?[[:space:]]+|sed[[:space:]]+-i[^|;&]*[[:space:]]|(cp|mv)[[:space:]][^|;&]*[[:space:]]|rm[[:space:]][^|;&]*)[^|;&[:space:]]*\.env(\.[A-Za-z0-9_-]+)?($|[[:space:];|&)])' <<<"$cmd" \
       && ! grep -Eq '\.env\.example' <<<"$cmd"; then
      echo "Blocked: this command would change a .env file, which holds secret keys. Aereon edits .env by hand — tell them exactly what line to add or change instead." >&2
      exit 2
    fi ;;
esac
exit 0
