# Notes for agents working in this repository

## Branching

- Work on `main` directly. Do not create a separate development branch or a pull request unless the owner asks for one.
- A push to `main` builds the site, runs the Playwright suite and deploys to GitHub Pages (`.github/workflows`). An article is not visible on the live site until it is on `main`.
- Because every push deploys, run `npm run build` and `npm test` before pushing.

## Where things are

See `README.md` for how articles, cards and widgets work and how to run the site.
