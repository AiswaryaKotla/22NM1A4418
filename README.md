
# afm-logging-middleware

A tiny client-side logging middleware meant for the AffordMed campus task.

- No `console.log` usage.
- Persists logs to `localStorage`.
- Optional HTTP transport to flush logs to a server (Bearer token supported).
- Helper to wrap `fetch` for API request/response/error logging.

## API

```js
import { createLogger } from "afm-logging-middleware";

const logger = createLogger({
  appName: "url-shortener",
  level: "info",            // debug | info | warn | error
  storageKey: "afm:logs",
  endpoint: "",             // optional: e.g. http://20.244.56.144/evaluation-service/logs
  token: "",                // optional: Bearer token
  batchSize: 20
});

logger.info("hello", { anything: "you like" });
logger.error("oops", { reason: "bad" });

// Wrap fetch
const fetchWithLogging = logger.wrapFetch(fetch);
const resp = await fetchWithLogging("/api/thing");
```

