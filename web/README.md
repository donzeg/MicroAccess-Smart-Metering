# MSM Operations Web Application

The SvelteKit application is the MicroAccess operating workspace for the smart
meter estate. Its first production slice provides:

- secure management login through the MSM backend;
- live read-only SteamaCo estate visibility;
- communication freshness and assignment coverage charts;
- interpreted source, bulk and customer-load meter roles;
- priority exception categories and actions;
- searchable meter operations with a business-readable detail panel;
- customer assignment, balance and tariff visibility;
- a separate concise management brief using the same live dataset.
- an energy-mix page with exact date filters, hourly/daily/weekly/monthly
  grouping, solar target tracking and a future generator leg;
- a revenue and energy-cost page that allocates real provider usage charges to
  matched source energy without misrepresenting balance credits as cash.
- a floor operations overview and dedicated floor drill-down pages that keep
  permanent positions separate from current tenant names, assigned meters,
  interval usage, provisional value and transparent data coverage;
- a local tenancy register on each floor page for recording the actual tenant
  and effective start date, viewing prior occupants and exposing unattributed
  usage or provider-name drift instead of rewriting historical attribution.

No demonstration or fabricated meter records are used. When SteamaCo is not
configured or unavailable, the application shows an explicit connection state.

## Configuration

Copy `.env.example` to `.env` and set the internal backend URL:

```dotenv
MSM_API_BASE_URL=http://127.0.0.1:3000
```

The SteamaCo username and password do not belong in this web application's
environment. They stay in `backend/.env` so authentication and tokens remain
server-side.

## Run and verify

```bash
npm install
npm run dev
npm run check
npm run build
```

The Node production build uses `@sveltejs/adapter-node`.
