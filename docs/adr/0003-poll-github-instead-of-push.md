# Poll GitHub with conditional requests instead of push

Tabs stay fresh by polling GitHub at a rate set by where the tab is (focused, visible, background), using `If-None-Match` so unchanged responses come back as 304s that cost nothing against the rate limit. We rejected push via GitHub webhooks relayed through the worker over WebSockets: it needs a GitHub App installed in every org, Durable Objects and new infrastructure, and only covers repos where the app is installed, while polling works for every repo the user can read. Revisit if seconds-level latency becomes a product requirement.
