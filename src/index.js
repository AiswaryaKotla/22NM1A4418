
export class Logger {
  constructor(config = {}) {
    this.appName = config.appName || 'url-shortener';
    this.level = config.level || 'info';
    this.storageKey = config.storageKey || `${this.appName}:logs`;
    this.max = config.max || 1000;
    this.endpoint = config.endpoint || null;
    this.token = config.token || null;
    this.batchSize = config.batchSize || 20;
    this.buffer = [];
    this.subscribers = new Set();
    this._load();
  }

  _levels() { return ['debug','info','warn','error']; }
  _enabled(level) { return this._levels().indexOf(level) >= this._levels().indexOf(this.level); }
  _now() { return new Date().toISOString(); }

  _load() {
    try {
      this.logs = JSON.parse(localStorage.getItem(this.storageKey) || '[]');
    } catch {
      this.logs = [];
    }
  }
  _persist() {
    localStorage.setItem(this.storageKey, JSON.stringify(this.logs.slice(-this.max)));
    this._notify();
  }
  _notify() {
    for (const fn of this.subscribers) {
      try { fn(this.logs); } catch {}
    }
  }

  subscribe(fn) { this.subscribers.add(fn); return () => this.subscribers.delete(fn); }

  log(level, message, context = {}) {
    if (!this._enabled(level)) return;
    const entry = { ts: this._now(), level, message, context };
    this.logs.push(entry);
    this.buffer.push(entry);
    this._persist();
    if (this.endpoint && this.token && this.buffer.length >= this.batchSize) {
      this.flush().catch(()=>{});
    }
  }

  debug(m, c) { this.log('debug', m, c); }
  info(m, c)  { this.log('info', m, c); }
  warn(m, c)  { this.log('warn', m, c); }
  error(m, c) { this.log('error', m, c); }

  getLogs() { return [...this.logs]; }
  clear() { this.logs = []; this.buffer = []; this._persist(); }

  async flush() {
    if (!this.endpoint || !this.token || this.buffer.length === 0) return;
    const entries = this.buffer.splice(0, this.buffer.length);
    const payload = { app: this.appName, entries };
    try {
      const res = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.token}`
        },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error(`flush failed: ${res.status}`);
    } catch (e) {
      // push back and also record the failure internally (no console.* allowed)
      this.buffer.unshift(...entries);
      this.logs.push({ ts: this._now(), level: 'error', message: 'log_flush_failed', context: { error: String(e) } });
      this._persist();
    }
  }

  wrapFetch(fetchImpl = fetch) {
    return async (url, options = {}) => {
      const started = performance.now();
      const method = (options.method || 'GET').toUpperCase();
      this.info('api_request', { url, method });
      try {
        const res = await fetchImpl(url, options);
        const took = Math.round(performance.now() - started);
        this.info('api_response', { url, status: res.status, tookMs: took });
        return res;
      } catch (e) {
        const took = Math.round(performance.now() - started);
        this.error('api_error', { url, tookMs: took, error: String(e) });
        throw e;
      }
    };
  }
}

export function createLogger(config) { return new Logger(config); }
