/*
 * api-web.js — browser-mode bridge.
 *
 * When the app runs in a normal web browser (served by server.js) instead of
 * Electron, there is no preload script, so window.api is not defined. This
 * shim provides the same small API the UI expects, backed by fetch() calls to
 * the local server for persistence and by browser downloads/uploads for
 * export/import.
 *
 * In Electron the preload script defines window.api BEFORE this runs, so the
 * guard below makes this a no-op there. One index.html serves both modes.
 */
(function () {
  if (window.api) return; // Electron already provided the real bridge.

  function jsonPost(url, body) {
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  }

  function downloadBlob(blob, filename) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  window.api = {
    load: function () {
      return fetch('/api/load').then(function (r) { return r.json(); });
    },

    save: function (data) {
      return jsonPost('/api/save', data)
        .then(function (r) { return r.json(); })
        .catch(function (err) { return { ok: false, error: String(err) }; });
    },

    // Save a JSON backup straight to the browser's Downloads folder.
    exportData: function (data) {
      try {
        var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        downloadBlob(blob, 'gradebook-backup.json');
        return Promise.resolve({ ok: true });
      } catch (err) {
        return Promise.resolve({ ok: false, error: String(err) });
      }
    },

    // Build the .xlsx on the server (it needs Node), then download it.
    exportXlsx: function (payload) {
      return jsonPost('/api/export-xlsx', payload || {})
        .then(function (r) {
          if (!r.ok) return { ok: false, error: 'Export failed' };
          return r.blob().then(function (blob) {
            downloadBlob(blob, (payload && payload.defaultName) || 'grades.xlsx');
            return { ok: true };
          });
        })
        .catch(function (err) { return { ok: false, error: String(err) }; });
    },

    // Read a backup file the teacher picks, without any native dialog.
    importData: function () {
      return new Promise(function (resolve) {
        var input = document.createElement('input');
        input.type = 'file';
        input.accept = 'application/json,.json';
        input.style.display = 'none';
        document.body.appendChild(input);
        input.addEventListener('change', function () {
          var file = input.files && input.files[0];
          document.body.removeChild(input);
          if (!file) { resolve({ ok: false, canceled: true }); return; }
          var reader = new FileReader();
          reader.onload = function () {
            try {
              resolve({ ok: true, data: JSON.parse(String(reader.result)) });
            } catch (err) {
              resolve({ ok: false, error: 'That file is not a valid backup.' });
            }
          };
          reader.onerror = function () { resolve({ ok: false, error: 'Could not read the file.' }); };
          reader.readAsText(file);
        });
        input.click();
      });
    }
  };
})();
