export function renderAdminLoginPage({ error = '' } = {}) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Photobooth Admin Login</title>
    ${adminStyles()}
  </head>
  <body class="admin-login-body">
    <main class="login-card">
      <p class="eyebrow">Photobooth Activation</p>
      <h1>Admin Login</h1>
      <p class="muted">Enter the server admin secret to manage activation keys.</p>
      ${error ? `<p class="alert error">${escapeHtml(error)}</p>` : ''}
      <form method="post" action="/admin/login" class="login-form">
        <label for="admin-secret">Admin secret</label>
        <input id="admin-secret" name="adminSecret" type="password" autofocus autocomplete="current-password" />
        <button type="submit">Log in</button>
      </form>
    </main>
  </body>
</html>`;
}

export function renderAdminDashboardPage() {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Photobooth License Admin</title>
    ${adminStyles()}
  </head>
  <body>
    <div class="shell">
      <header class="topbar">
        <div>
          <p class="eyebrow">Photobooth Activation</p>
          <h1>License Admin</h1>
          <p class="muted">Generate, search, bind, unbind, and manage manual activation keys.</p>
        </div>
        <form method="post" action="/admin/logout">
          <button class="secondary" type="submit">Log out</button>
        </form>
      </header>

      <section class="grid two-col">
        <article class="card">
          <h2>Generate manual keys</h2>
          <form id="create-form" class="form-grid">
            <label>
              Feature
              <select name="feature">
                <option value="base_app">Base App</option>
                <option value="qr_download">QR Download</option>
                <option value="template_editor">Template Editor</option>
                <option value="premium_bundle">Premium Bundle</option>
              </select>
            </label>
            <label>
              Count
              <input name="count" type="number" min="1" max="50" value="1" />
            </label>
            <label id="duration-field">
              Premium duration
              <select name="duration">
                <option value="30d">1 month</option>
                <option value="90d">3 months</option>
                <option value="180d">6 months</option>
                <option value="365d">1 year</option>
              </select>
              <span id="duration-preview" class="field-hint"></span>
            </label>
            <p id="base-expiry-note" class="field-note wide">Base App keys do not expire.</p>
            <label>
              Customer email or name
              <input name="customerEmail" type="text" placeholder="optional" />
            </label>
            <label>
              Admin note
              <input name="adminNote" type="text" placeholder="payment ref, event, support note" />
            </label>
            <button type="submit">Generate</button>
          </form>
          <div id="create-result" class="result"></div>
        </article>

        <article class="card">
          <h2>Filters</h2>
          <form id="filter-form" class="form-grid">
            <label class="wide">
              Search
              <input name="query" type="search" placeholder="key, license id, device id, email, note" />
            </label>
            <label>
              Feature
              <select name="feature">
                <option value="">All</option>
                <option value="base_app">Base App</option>
                <option value="qr_download">QR Download</option>
                <option value="template_editor">Template Editor</option>
                <option value="premium_bundle">Premium Bundle</option>
              </select>
            </label>
            <label>
              Status
              <select name="status">
                <option value="">All</option>
                <option value="active">Active</option>
                <option value="canceled">Canceled</option>
                <option value="expired">Expired</option>
                <option value="pending">Pending</option>
                <option value="past_due">Past due</option>
              </select>
            </label>
            <label>
              Source
              <select name="source">
                <option value="">All</option>
                <option value="manual">Manual</option>
                <option value="subscription">Subscription</option>
              </select>
            </label>
            <label>
              Device
              <select name="boundState">
                <option value="">All</option>
                <option value="bound">Bound</option>
                <option value="unbound">Unbound</option>
              </select>
            </label>
            <label>
              Activity
              <select name="activity">
                <option value="">All</option>
                <option value="activated">Activated</option>
                <option value="transferred">Transferred</option>
              </select>
            </label>
            <button type="submit">Apply filters</button>
          </form>
        </article>
      </section>

      <section class="card">
        <div class="list-head">
          <div>
            <h2>License keys</h2>
            <p id="list-summary" class="muted">Loading...</p>
          </div>
          <button id="refresh-btn" class="secondary" type="button">Refresh</button>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Key</th>
                <th>Feature</th>
                <th>Status</th>
                <th>Expiration</th>
                <th>Device</th>
                <th>Customer / Note</th>
                <th>Activity</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody id="license-rows"></tbody>
          </table>
        </div>
        <div class="pager">
          <button id="prev-page" class="secondary" type="button">Previous</button>
          <span id="page-label"></span>
          <button id="next-page" class="secondary" type="button">Next</button>
        </div>
      </section>
    </div>

    <script>
      const state = { limit: 25, offset: 0, total: 0, filters: {} };
      const features = {
        base_app: 'Base App',
        qr_download: 'QR Download',
        template_editor: 'Template Editor',
        premium_bundle: 'Premium Bundle'
      };
      const premiumFeatures = new Set(['qr_download', 'template_editor', 'premium_bundle']);
      const premiumDurations = {
        '30d': { label: '1 month', days: 30 },
        '90d': { label: '3 months', days: 90 },
        '180d': { label: '6 months', days: 180 },
        '365d': { label: '1 year', days: 365 }
      };

      const $ = (id) => document.getElementById(id);

      function escapeHtml(value) {
        return String(value ?? '')
          .replaceAll('&', '&amp;')
          .replaceAll('<', '&lt;')
          .replaceAll('>', '&gt;')
          .replaceAll('"', '&quot;')
          .replaceAll("'", '&#39;');
      }

      function formatDate(value) {
        if (!value) return 'None';
        return new Date(value).toLocaleString();
      }

      function durationLabelFromMs(value) {
        const match = Object.values(premiumDurations).find((duration) => {
          return duration.days * 24 * 60 * 60 * 1000 === value;
        });
        return match ? match.label : Math.round(value / (24 * 60 * 60 * 1000)) + ' days';
      }

      function formatExpiration(license) {
        if (license.feature === 'base_app') return 'No expiry';
        if (license.expiresAt) return formatDate(license.expiresAt);
        if (license.currentPeriodEnd) return formatDate(license.currentPeriodEnd);
        if (license.activationDurationMs) {
          return 'Starts on activation (' + durationLabelFromMs(license.activationDurationMs) + ')';
        }
        return 'Legacy / no expiry';
      }

      function formValues(form) {
        return Object.fromEntries(new FormData(form).entries());
      }

      function updateDurationField() {
        const form = $('create-form');
        const feature = form.elements.feature.value;
        const duration = form.elements.duration;
        const field = $('duration-field');
        const baseNote = $('base-expiry-note');
        const preview = $('duration-preview');
        const premium = premiumFeatures.has(feature);
        field.style.display = premium ? 'grid' : 'none';
        baseNote.style.display = premium ? 'none' : 'block';
        duration.disabled = !premium;
        duration.required = premium;
        if (premium) {
          const selected = premiumDurations[duration.value] || premiumDurations['30d'];
          preview.textContent =
            selected.label + ' starts on the customer\\'s first successful activation.';
        } else {
          preview.textContent = '';
        }
      }

      function buildQuery() {
        const params = new URLSearchParams({
          limit: String(state.limit),
          offset: String(state.offset)
        });
        for (const [key, value] of Object.entries(state.filters)) {
          if (value) params.set(key, value);
        }
        return params.toString();
      }

      async function api(path, options = {}) {
        const response = await fetch(path, {
          ...options,
          headers: {
            'Content-Type': 'application/json',
            ...(options.headers || {})
          }
        });
        const json = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(json.error || 'Request failed.');
        }
        return json;
      }

      async function loadLicenses() {
        const data = await api('/admin/api/licenses?' + buildQuery());
        state.total = data.total;
        $('list-summary').textContent = data.total + ' license' + (data.total === 1 ? '' : 's') + ' found';
        $('page-label').textContent =
          data.total === 0
            ? 'Page 0 of 0'
            : 'Page ' + (Math.floor(state.offset / state.limit) + 1) + ' of ' + Math.ceil(data.total / state.limit);
        $('prev-page').disabled = state.offset <= 0;
        $('next-page').disabled = state.offset + state.limit >= data.total;
        renderRows(data.licenses);
      }

      function renderRows(licenses) {
        const rows = licenses.map((license) => {
          const bound = license.boundDeviceId || 'Unbound';
          const note = [license.customerEmail, license.adminNote]
            .filter(Boolean)
            .map(escapeHtml)
            .join('<br>');
          const activity =
            'Created: ' + formatDate(license.createdAt) + '<br>' +
            'Activated: ' + formatDate(license.lastActivatedAt) + '<br>' +
            'Transferred: ' + formatDate(license.lastTransferredAt);
          const status = license.effectiveStatus || license.status;
          const rawStatus =
            license.effectiveStatus && license.effectiveStatus !== license.status
              ? '<small>Stored: ' + escapeHtml(license.status) + '</small>'
              : '';
          const expiration = formatExpiration(license);
          return '<tr>' +
            '<td><code>' + escapeHtml(license.licenseKey) + '</code><small>' + escapeHtml(license.licenseId) + '</small></td>' +
            '<td>' + escapeHtml(features[license.feature] || license.feature) + '<small>' + escapeHtml(license.source) + '</small></td>' +
            '<td><span class="status ' + escapeHtml(status) + '">' + escapeHtml(status) + '</span>' + rawStatus + '</td>' +
            '<td class="activity">' + escapeHtml(expiration) + '</td>' +
            '<td class="device">' + escapeHtml(bound) + '</td>' +
            '<td>' + (note || '<span class="muted">None</span>') + '</td>' +
            '<td class="activity">' + activity + '</td>' +
            '<td class="actions">' +
              '<button data-action="status" data-key="' + escapeHtml(license.licenseKey) + '" data-status="active">Active</button>' +
              '<button data-action="status" data-key="' + escapeHtml(license.licenseKey) + '" data-status="canceled">Cancel</button>' +
              '<button data-action="status" data-key="' + escapeHtml(license.licenseKey) + '" data-status="expired">Expire</button>' +
              '<button data-action="unbind" data-key="' + escapeHtml(license.licenseKey) + '">Unbind</button>' +
            '</td>' +
          '</tr>';
        });
        $('license-rows').innerHTML =
          rows.join('') || '<tr><td colspan="8" class="empty">No licenses match the current filters.</td></tr>';
      }

      $('create-form').addEventListener('submit', async (event) => {
        event.preventDefault();
        const values = formValues(event.currentTarget);
        if (!premiumFeatures.has(values.feature)) {
          delete values.duration;
        }
        $('create-result').textContent = 'Generating...';
        try {
          const result = await api('/admin/api/licenses', {
            method: 'POST',
            body: JSON.stringify(values)
          });
          const generatedRows = result.licenses.map((item) => {
            return '<tr>' +
              '<td><code>' + escapeHtml(item.licenseKey) + '</code></td>' +
              '<td>' + escapeHtml(features[item.feature] || item.feature) + '</td>' +
              '<td>' + escapeHtml(formatExpiration(item)) + '</td>' +
            '</tr>';
          }).join('');
          $('create-result').innerHTML =
            '<p class="ok">Created ' + result.licenses.length + ' key(s):</p>' +
            '<div class="generated-table-wrap"><table class="generated-table">' +
              '<thead><tr><th>Key</th><th>Feature</th><th>Expiration</th></tr></thead>' +
              '<tbody>' + generatedRows + '</tbody>' +
            '</table></div>';
          state.offset = 0;
          await loadLicenses();
        } catch (error) {
          $('create-result').innerHTML = '<p class="bad">' + escapeHtml(error.message) + '</p>';
        }
      });

      $('filter-form').addEventListener('submit', async (event) => {
        event.preventDefault();
        state.filters = formValues(event.currentTarget);
        state.offset = 0;
        await loadLicenses();
      });

      $('refresh-btn').addEventListener('click', loadLicenses);
      $('create-form').elements.feature.addEventListener('change', updateDurationField);
      $('create-form').elements.duration.addEventListener('change', updateDurationField);
      $('prev-page').addEventListener('click', async () => {
        state.offset = Math.max(0, state.offset - state.limit);
        await loadLicenses();
      });
      $('next-page').addEventListener('click', async () => {
        state.offset += state.limit;
        await loadLicenses();
      });

      $('license-rows').addEventListener('click', async (event) => {
        const button = event.target.closest('button');
        if (!button) return;
        const key = button.dataset.key;
        try {
          if (button.dataset.action === 'status') {
            await api('/admin/api/licenses/' + encodeURIComponent(key), {
              method: 'PATCH',
              body: JSON.stringify({ status: button.dataset.status })
            });
          }
          if (button.dataset.action === 'unbind') {
            await api('/admin/api/licenses/' + encodeURIComponent(key) + '/unbind', {
              method: 'POST',
              body: JSON.stringify({})
            });
          }
          await loadLicenses();
        } catch (error) {
          alert(error.message);
        }
      });

      updateDurationField();
      loadLicenses().catch((error) => {
        $('list-summary').textContent = error.message;
      });
    </script>
  </body>
</html>`;
}

function adminStyles() {
  return `<style>
    :root {
      color-scheme: light;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      color: #1f2937;
      background: #f8fafc;
    }
    body {
      margin: 0;
      background: #f8fafc;
    }
    button, input, select {
      font: inherit;
    }
    button {
      border: 0;
      border-radius: 10px;
      padding: 10px 14px;
      background: #0eadb9;
      color: #fff;
      font-weight: 800;
      cursor: pointer;
    }
    button.secondary {
      background: #e5e7eb;
      color: #374151;
    }
    button:disabled {
      opacity: 0.45;
      cursor: not-allowed;
    }
    h1, h2, p {
      margin-top: 0;
    }
    h1 {
      margin-bottom: 8px;
      font-size: clamp(32px, 5vw, 54px);
      line-height: 1;
    }
    h2 {
      font-size: 20px;
    }
    .admin-login-body {
      min-height: 100vh;
      display: grid;
      place-items: center;
      padding: 20px;
      box-sizing: border-box;
    }
    .shell {
      width: min(1280px, calc(100% - 32px));
      margin: 0 auto;
      padding: 24px 0 40px;
    }
    .topbar {
      display: flex;
      justify-content: space-between;
      gap: 20px;
      align-items: flex-start;
      margin-bottom: 18px;
    }
    .eyebrow {
      margin-bottom: 8px;
      color: #0eadb9;
      font-size: 12px;
      font-weight: 900;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }
    .muted {
      color: #6b7280;
    }
    .grid {
      display: grid;
      gap: 16px;
      margin-bottom: 16px;
    }
    .two-col {
      grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);
    }
    .card, .login-card {
      background: #fff;
      border: 1px solid #e5e7eb;
      border-radius: 16px;
      box-shadow: 0 8px 28px rgba(15, 23, 42, 0.08);
      padding: 22px;
    }
    .login-card {
      width: min(100%, 440px);
    }
    .login-form, .form-grid {
      display: grid;
      gap: 12px;
    }
    .form-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    label {
      display: grid;
      gap: 6px;
      color: #475569;
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }
    input, select {
      min-height: 42px;
      border: 1px solid #d1d5db;
      border-radius: 10px;
      padding: 0 12px;
      color: #111827;
      background: #fff;
      box-sizing: border-box;
    }
    .wide {
      grid-column: 1 / -1;
    }
    .result {
      margin-top: 12px;
    }
    .field-hint {
      color: #0f766e;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0;
      text-transform: none;
    }
    .field-note {
      margin: 0;
      border: 1px solid rgba(14, 173, 185, 0.22);
      border-radius: 10px;
      padding: 10px 12px;
      background: rgba(14, 173, 185, 0.08);
      color: #0f766e;
      font-size: 13px;
      font-weight: 800;
    }
    pre {
      overflow: auto;
      padding: 12px;
      border-radius: 10px;
      background: #111827;
      color: #fff;
    }
    .generated-table-wrap {
      overflow-x: auto;
      border: 1px solid #e5e7eb;
      border-radius: 12px;
    }
    .generated-table {
      min-width: 640px;
      background: #fff;
    }
    .generated-table th,
    .generated-table td {
      padding: 10px 12px;
    }
    .ok {
      color: #15803d;
      font-weight: 800;
    }
    .bad, .alert.error {
      color: #b91c1c;
      font-weight: 800;
    }
    .list-head, .pager {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      align-items: center;
    }
    .table-wrap {
      overflow-x: auto;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      min-width: 1100px;
    }
    th, td {
      border-top: 1px solid #e5e7eb;
      padding: 12px 10px;
      text-align: left;
      vertical-align: top;
      font-size: 13px;
    }
    th {
      color: #475569;
      font-size: 11px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    code {
      display: block;
      font-weight: 900;
      color: #111827;
    }
    small {
      display: block;
      margin-top: 4px;
      color: #6b7280;
    }
    .device {
      max-width: 190px;
      overflow-wrap: anywhere;
    }
    .activity {
      color: #6b7280;
      min-width: 180px;
    }
    .status {
      display: inline-flex;
      border-radius: 999px;
      padding: 4px 9px;
      background: #f3f4f6;
      color: #4b5563;
      font-weight: 800;
      text-transform: capitalize;
    }
    .status.active {
      background: rgba(22, 163, 74, 0.12);
      color: #15803d;
    }
    .status.canceled, .status.expired {
      background: rgba(254, 109, 109, 0.16);
      color: #b91c1c;
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      min-width: 210px;
    }
    .actions button {
      padding: 7px 9px;
      border-radius: 8px;
      background: #f3f4f6;
      color: #374151;
      font-size: 12px;
    }
    .empty {
      text-align: center;
      color: #6b7280;
      padding: 28px;
    }
    @media (max-width: 900px) {
      .two-col, .form-grid {
        grid-template-columns: 1fr;
      }
      .topbar, .list-head {
        flex-direction: column;
        align-items: stretch;
      }
    }
  </style>`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
