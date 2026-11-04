# Archived upstream workflows

These workflows are retained from OpenWhispr for reference. They are outside
`.github/workflows` and do not run in this repository. They include upstream
signing, cloud credentials, mobile builds, canaries, and package submissions.

Canote uses only the desktop Windows CI and release workflows in
`.github/workflows`. Those use GitHub's temporary built-in token and do not
bundle runtime API keys or `.env` files.
