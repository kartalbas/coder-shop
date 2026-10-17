BUG REPORT FROM THE USER — GitHub issue #1 (https://github.com/kartalbas/coder-shop/issues/1). Read docs/REQUIREMENTS.md, docs/ARCHITECTURE.md and docs/PROGRESS.md
first.

"Im Admin muss ich für jeden Menü-Klick Benutzername und Passwort neu eingeben."

Observed by the lead (production build, `next start -H 0.0.0.0 -p 4000`, Chrome):
- opened as http://192.168.10.210:4000 (the machine's LAN address, as the user does from
  another PC): login succeeds and shows /admin; every following admin page
  (/admin/orders, /admin/products, …) redirects to /admin/login again;
- opened as http://localhost:4000: the same steps work, the admin pages stay open.

Find the root cause, fix it so the admin works from another machine on the LAN, and add an
end-to-end test that fails without your fix. Do not weaken security in production — document
any trade-off in docs/DECISIONS.md. `npm run build`, `npm run lint`, `npm test` and
`npm run test:e2e` pass. Update docs/PROGRESS.md, commit "BUG1: <summary> (fixes #1)" and `git push` — the "fixes #1" closes the issue. Stop.
