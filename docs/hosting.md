# Hosting WING on Cloudflare Workers

WING is a static single-page app. `npm run build` writes the site to
`frontend/dist`, and Cloudflare Workers serves those files as
[static assets](https://developers.cloudflare.com/workers/static-assets/).
No Worker code of ours runs, and requests to static assets are
[free and unlimited](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/).
Paths that are not files, such as `/route/test`, get `index.html`
([single-page application](https://developers.cloudflare.com/workers/static-assets/routing/single-page-application/)),
so links and refresh keep working when we add React Router.

The settings live in [`frontend/wrangler.jsonc`](../frontend/wrangler.jsonc).
[Workers Builds](https://developers.cloudflare.com/workers/ci-cd/builds/),
Cloudflare's Git integration, builds and deploys the site from GitHub, so day
to day nobody deploys from a laptop.

| | Cloudflare Worker | Deployed when | Address | Supabase project |
|---|---|---|---|---|
| Staging | `wing-staging` | every push to `main` | `https://wing-staging.<subdomain>.workers.dev` | staging |
| Previews | Previews of `wing-staging` | every push to any other branch; the URL is posted on the pull request | `https://<preview-name>-wing-staging.<subdomain>.workers.dev` | staging |
| Live (from April) | `wing` | every push to `live` | `https://wing.<subdomain>.workers.dev`, then our own domain | production |

`<subdomain>` is the account's `workers.dev` subdomain, chosen in step 1.

## How the Supabase settings reach the site

`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are not read when the page
runs. Vite pastes their values into the JavaScript when it builds
([Vite: env variables](https://vite.dev/guide/env-and-mode)). On Cloudflare
there is no `.env` file (it is not in Git), so the values must be
**build variables**:

- They go in each Worker's **Settings** > **Build** > **Build variables and
  secrets**. These are "accessible only to your build"
  ([Builds configuration](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/)).
- Not in **Settings** > **Variables & Secrets**. Those are runtime variables
  and never reach a static site.
- Each Worker has its own build variables, so staging and live use different
  Supabase projects. The docs describe no separate set for preview builds,
  so Previews should get the staging values. Check this on the first Preview.
- Variables set in the build environment win over a `.env` file (checked:
  values set this way end up in the bundle).
- The publishable key (`sb_publishable_...`; on older projects the legacy
  anon key) is public by design: it ships in the bundle, and Row Level
  Security decides what it can do. Never put the secret key (`sb_secret_...`)
  or the legacy `service_role` key in a `VITE_` variable or a Cloudflare
  build variable.

## 1. Create the Cloudflare account

1. Go to the [sign-up page](https://dash.cloudflare.com/sign-up), enter
   **Email** and **Password**, select **Create Account**, then verify your
   email ([Create account](https://developers.cloudflare.com/fundamentals/account/create-account/)).
2. Turn on two-factor authentication: **My Profile** > **Authentication**,
   then **Add** next to **Mobile App Authentication** or **Security Key
   Authentication**. Save the backup codes
   ([2FA](https://developers.cloudflare.com/fundamentals/user-profiles/2fa/)).
3. Choose the `workers.dev` subdomain: on **Workers & Pages**, select
   **Change** next to **Your subdomain**, for example `wing-bath`
   ([workers.dev](https://developers.cloudflare.com/workers/configuration/routing/workers-dev/)).
4. Invite at least one other lead so the team is not locked out if you are
   away: **Members** > **Invite members**, enter their email, then under
   **Add permission policies** set the scope to the entire account, tick the
   **Super Administrator - All Privileges** role, select **Create policy**
   and **Invite members**. Only that role can manage members and billing
   (**Administrator** cannot)
   ([Manage members](https://developers.cloudflare.com/fundamentals/manage-members/manage/),
   [Roles](https://developers.cloudflare.com/fundamentals/manage-members/roles/)).
   Invite the GitHub repository's owner too: step 2.3 needs them.

## 2. Connect the repository (the staging Worker)

1. First get `frontend/wrangler.jsonc` onto `main`, because Workers Builds
   reads it from the root directory.
2. In **Workers & Pages**, select **Create application**, then **GitHub**.
3. Authenticate with GitHub and install the **Cloudflare Workers and Pages**
   GitHub App. Under **Repository access**, choose **Only select
   repositories** and pick this repository
   ([GitHub integration](https://developers.cloudflare.com/workers/ci-cd/builds/git-integration/github-integration/)).
   This repository belongs to AbdollahHosseini's personal GitHub account,
   and only that account can install GitHub Apps on it; collaborators
   cannot. So invite the owner to the Cloudflare account in step 1.4 and have
   them do steps 2.2-2.4 while signed in to Cloudflare. Alternatively, first
   transfer the repository to a GitHub organisation; then an organisation
   owner (or someone with the GitHub Apps Manager role) installs the app.
4. Select the repository, fill in the settings below, and select
   **Save and Deploy**.

| Setting | Value |
|---|---|
| Worker name | `wing-staging` (it must match the `name` in `wrangler.jsonc`, or the build fails) |
| Git branch | `main` |
| Build command | `npm run build` |
| Deploy command | `npx wrangler deploy --env staging` |
| Preview command | `npx wrangler preview --env staging` |
| Root directory | `frontend` |
| Build variables and secrets | `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (the project's publishable key) from the **staging** Supabase project, and `NODE_VERSION` = `26` |
| API token | leave empty (Cloudflare creates one) |

If the create screen does not show every field, open the Worker afterwards,
go to **Settings** > **Build**, and set the rest there. Changes apply from the
next build.

Workers Builds installs the dependencies from `package-lock.json` by itself.
The `--env staging` flags matter: without them Wrangler uses the top-level
settings instead of the staging environment
([Compare workflows](https://developers.cloudflare.com/workers/previews/compare-workflows/)).
`NODE_VERSION` matches CI (`.nvmrc` says 26). The build image ships with
Node 24.22.1 and says all versions can be chosen
([Build image](https://developers.cloudflare.com/workers/ci-cd/builds/build-image/)).
If the build log shows Node 26 cannot be installed, delete the variable:
24.22.1 also works with our `engines` (`^22.12.0 || ^24.0.0 || >=26.0.0`).

## 3. Turn on Previews for branches and pull requests

1. In `wing-staging`, go to **Settings** > **Build** > **Branch control**.
   Check that the production branch is `main`, and tick **Enable Preview
   Builds** ([Build branches](https://developers.cloudflare.com/workers/ci-cd/builds/build-branches/)).
2. Check that the **Preview command** is `npx wrangler preview --env staging`.
3. If a **Set up Worker Previews** banner appears, select **Set up**, then
   **Switch to Worker Previews**. This cannot be undone, and our site has no
   runtime variables or bindings to configure.
4. Optional: under **Settings** > **Build** > **Build watch paths**, set
   **Include paths** to `frontend/*`, so pushes that only change `backend/`
   or `docs/` do not build
   ([Build watch paths](https://developers.cloudflare.com/workers/ci-cd/builds/build-watch-paths/)).

From then on, every push to a branch other than `main` creates or updates a
Preview, and Cloudflare comments the Preview URL on the pull request
([Previews](https://developers.cloudflare.com/workers/previews/)). Good to know:

- Worker Previews are an open beta (Wrangler 4.156.2 says so).
- `wrangler.jsonc` needs a `previews` block for this. The one under
  `env.staging` is empty because the site needs no Preview settings
  ([Previews configuration](https://developers.cloudflare.com/workers/previews/configuration/)).
- Preview URLs are public but send `X-Robots-Tag: noindex`. The data behind
  them is the staging project's, read-only through Row Level Security.
- The Free plan keeps 100 Previews per Worker and deletes the least recently
  deployed one when full.
- These are not "Version URLs" (formerly called preview URLs,
  [Version URLs](https://developers.cloudflare.com/workers/configuration/previews/)).
  We do not need those.

## 4. Check staging

1. Merge something into `main`. In `wing-staging`, open **Deployments** and
   select **View build history** to watch the build.
2. Open `https://wing-staging.<subdomain>.workers.dev`, then a made-up path such
   as `/route/test`. Both should show the app.
3. If the page is blank, check the browser console. A missing build variable
   makes `createClient` fail when the page loads.

Workers Builds does not wait for GitHub Actions: it deploys whatever reaches
`main`. That is why `main` needs branch protection that requires the CI checks:
see "Protecting `main`" in the [README](../README.md#protecting-main).

## 5. Go live (from launch in April)

The live Worker is a second Worker connected to the same repository. It
deploys only from a `live` branch, so going live is a pull request from
`main` into `live`.

1. In GitHub, create the `live` branch from `main` and protect it like `main`
   (see "Protecting `main`" in the [README](../README.md#protecting-main)).
2. In **Workers & Pages**, select **Create application**, then **GitHub**, and
   pick the same repository with these settings:

| Setting | Value |
|---|---|
| Worker name | `wing` |
| Git branch | `live` |
| Build command | `npm run build` |
| Deploy command | `npx wrangler deploy --env production` |
| Root directory | `frontend` |
| Build variables and secrets | `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (the project's publishable key) from the **production** Supabase project, and `NODE_VERSION` = `26` |

3. In `wing`, go to **Settings** > **Build** > **Branch control**, check that
   the production branch is `live`, and **untick Enable Preview Builds**.
   Previews already come from `wing-staging`. Leaving it ticked would start a
   second build for every branch push, and it would fail, because only
   `env.staging` has a `previews` block.
4. Promote: open a pull request from `main` into `live` and merge it. Workers
   Builds deploys `wing`.
5. Roll back: in `wing`, open **Deployments**, select the three dots next to
   an earlier version, and select **Rollback**
   ([Rollbacks](https://developers.cloudflare.com/workers/configuration/versions-and-deployments/rollbacks/)).
   Then fix `live` with a new pull request.

### The live web address

Cloudflare recommends a custom domain rather than `workers.dev` for production
([workers.dev](https://developers.cloudflare.com/workers/configuration/routing/workers-dev/)).
A Custom Domain needs "an active Cloudflare zone" that we own, and cannot use a
hostname that already has a CNAME record
([Custom Domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/)).

- **Our own domain** (about £10–20 a year): add it to the Cloudflare account,
  then in `wing` go to **Settings** > **Domains & Routes** > **Add** >
  **Custom Domain**. Then add the same domain to `env.production` in
  `wrangler.jsonc` as `"routes": [{ "pattern": "<domain>", "custom_domain": true }]`,
  so the next deploy keeps it.
- **A `bath.ac.uk` address**: the university owns that zone, so this is IT's
  call. They might host the site themselves (the other option in the tech
  stack proposal), or point a `bath.ac.uk` page at our address. Ask them early.

When staff logins arrive, add the staging, Preview and live addresses to the
redirect URLs in Supabase Auth.

## Useful commands (in `frontend/`)

| Command | What it does | Needs a Cloudflare login? |
|---|---|---|
| `npx wrangler deploy --dry-run --env staging` (or `--env production`) | Checks `wrangler.jsonc` and counts the files it would upload from `dist` (run `npm run build` first; prefix with `WRANGLER_LOG=debug` to see the file names) | No |
| `npm run build`, then `npx wrangler dev --env staging` | Serves `dist` the way Cloudflare will, at http://localhost:8787 | No |
| `npx wrangler login`, then `npm run build` and `npx wrangler deploy --env staging` | Manual staging deploy if Workers Builds is down. It bakes in **your** `.env` values | Yes |
| `npx wrangler preview --env staging` | Manual Preview of the current branch. It checks the login before anything else, so it cannot be tried without an account | Yes |

There is deliberately no manual production deploy. A laptop build would bake
in whatever the local `.env` holds, so live builds only come from the `wing`
Worker's build variables.

## Why there is no Cloudflare Vite plugin

Cloudflare's [React guide](https://developers.cloudflare.com/workers/framework-guides/web-apps/react/)
adds `@cloudflare/vite-plugin`. That plugin runs Worker code (`main`) in the
Workers runtime during `npm run dev` and builds it. WING has no Worker code,
so the plugin would only change the dev server and the output folder
(`dist/client`). An assets-only Worker with `assets.directory: "./dist"` does
the same job, and Vite's own dev server already serves `index.html` for
unknown paths. Revisit this only if we add Worker code, such as an API route
or custom headers.

## Docs used

- [React + Vite on Workers](https://developers.cloudflare.com/workers/framework-guides/web-apps/react/)
- [Static assets](https://developers.cloudflare.com/workers/static-assets/),
  [single-page application routing](https://developers.cloudflare.com/workers/static-assets/routing/single-page-application/),
  [billing and limitations](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/)
- [Wrangler configuration](https://developers.cloudflare.com/workers/wrangler/configuration/),
  [environments](https://developers.cloudflare.com/workers/wrangler/environments/)
- [Workers Builds](https://developers.cloudflare.com/workers/ci-cd/builds/),
  [configuration](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/),
  [build branches](https://developers.cloudflare.com/workers/ci-cd/builds/build-branches/),
  [build image](https://developers.cloudflare.com/workers/ci-cd/builds/build-image/),
  [build watch paths](https://developers.cloudflare.com/workers/ci-cd/builds/build-watch-paths/),
  [GitHub integration](https://developers.cloudflare.com/workers/ci-cd/builds/git-integration/github-integration/),
  [troubleshooting](https://developers.cloudflare.com/workers/ci-cd/builds/troubleshoot/)
- [Previews](https://developers.cloudflare.com/workers/previews/),
  [get started](https://developers.cloudflare.com/workers/previews/get-started/),
  [configuration](https://developers.cloudflare.com/workers/previews/configuration/),
  [compare workflows](https://developers.cloudflare.com/workers/previews/compare-workflows/),
  [Version URLs](https://developers.cloudflare.com/workers/configuration/previews/)
- [workers.dev](https://developers.cloudflare.com/workers/configuration/routing/workers-dev/),
  [Custom Domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/),
  [rollbacks](https://developers.cloudflare.com/workers/configuration/versions-and-deployments/rollbacks/)
- [Create account](https://developers.cloudflare.com/fundamentals/account/create-account/),
  [2FA](https://developers.cloudflare.com/fundamentals/user-profiles/2fa/),
  [manage members](https://developers.cloudflare.com/fundamentals/manage-members/manage/),
  [roles](https://developers.cloudflare.com/fundamentals/manage-members/roles/)
- [Vite: env variables and modes](https://vite.dev/guide/env-and-mode)
