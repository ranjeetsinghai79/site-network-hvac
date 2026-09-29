/*!
 * WebCrew AI widget — drop this on any site to give it a talking AI sales rep.
 *
 * Usage:
 *   <script src="https://ai-reception-459352382653.us-central1.run.app/widget.js"
 *           data-config="YOUR_CONFIG_ID" async></script>
 *
 * Optional attributes:
 *   data-ws                 override the widget-ws URL (defaults to deriving
 *                            wss://<this script's host>/widget-ws from the
 *                            script's own src)
 *   data-turnstile-sitekey  Cloudflare Turnstile site key (skips bot check if omitted)
 *   data-accent             accent color (default #2563EB)
 *   data-dark               header/launcher dark color (default #0d172b)
 *   data-name               label shown in the header (default "AI Assistant")
 *   data-position            "bottom-left" or "bottom-right" (default bottom-right)
 *   data-auto-open           open the full panel on arrival (default false)
 *   data-enabled             hard kill switch; "false" prevents mounting
 *
 * Runs inside a Shadow DOM so it never inherits or leaks CSS from the host
 * page. No build step, no dependencies — vanilla JS, ships as-is.
 */
(function () {
  'use strict';
  if (window.__webcrewWidgetLoaded) return;
  window.__webcrewWidgetLoaded = true;

  var scriptEl = document.currentScript;
  if (!scriptEl) {
    var scripts = document.getElementsByTagName('script');
    scriptEl = scripts[scripts.length - 1];
  }
  if (!scriptEl) { console.error('[WebCrew Widget] Could not locate the widget <script> tag.'); return; }

  var CONFIG_ID = scriptEl.getAttribute('data-config');
  if (!CONFIG_ID) { console.error('[WebCrew Widget] Missing data-config attribute — the widget needs your reception config ID.'); return; }

  var WS_URL;
  var explicitWs = scriptEl.getAttribute('data-ws');
  if (explicitWs) {
    WS_URL = explicitWs + (explicitWs.indexOf('?') === -1 ? '?' : '&') + 'config=' + encodeURIComponent(CONFIG_ID);
  } else {
    try {
      var srcUrl = new URL(scriptEl.src, window.location.href);
      var scheme = srcUrl.protocol === 'https:' ? 'wss:' : 'ws:';
      WS_URL = scheme + '//' + srcUrl.host + '/widget-ws?config=' + encodeURIComponent(CONFIG_ID);
    } catch (e) {
      console.error('[WebCrew Widget] Could not derive the widget server from the script src. Set data-ws explicitly.');
      return;
    }
  }

  var TURNSTILE_SITE_KEY = scriptEl.getAttribute('data-turnstile-sitekey') || '';
  var ACCENT = scriptEl.getAttribute('data-accent') || '#2563EB';
  var DARK = scriptEl.getAttribute('data-dark') || '#0d172b';
  var LABEL = scriptEl.getAttribute('data-name') || 'AI Assistant';
  var SIDE = scriptEl.getAttribute('data-position') === 'bottom-left' ? 'left' : 'right';
  var AUTO_OPEN = scriptEl.getAttribute('data-auto-open') === 'true';
  if (scriptEl.getAttribute('data-enabled') === 'false') return;

  // ── PCM helpers (ported from webcrew.app's avatar-widget.tsx) ──────────────

  function floatTo16BitPCM(input) {
    var out = new Int16Array(input.length);
    for (var i = 0; i < input.length; i++) {
      var s = Math.max(-1, Math.min(1, input[i]));
      out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return out;
  }

  // Box-filter (averaging) decimation, not point sampling. Naive nearest-
  // neighbor downsampling introduces aliasing that measurably degrades
  // Gemini's speech transcription (found auditing webcrew.app's own widget).
  function downsampleTo16k(input, inputRate) {
    if (inputRate === 16000) return input;
    var ratio = inputRate / 16000;
    var outLength = Math.floor(input.length / ratio);
    var out = new Float32Array(outLength);
    for (var i = 0; i < outLength; i++) {
      var start = Math.floor(i * ratio);
      var end = Math.min(input.length, Math.floor((i + 1) * ratio));
      var sum = 0;
      for (var j = start; j < end; j++) sum += input[j];
      out[i] = end > start ? sum / (end - start) : (input[start] || 0);
    }
    return out;
  }

  function int16ToBase64(pcm) {
    var bytes = new Uint8Array(pcm.buffer);
    var binary = '';
    for (var i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  }

  function base64ToInt16(b64) {
    var binary = atob(b64);
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new Int16Array(bytes.buffer);
  }

  function rmsOf(pcm) {
    if (pcm.length === 0) return 0;
    var sum = 0;
    for (var i = 0; i < pcm.length; i++) sum += pcm[i] * pcm[i];
    return Math.sqrt(sum / pcm.length) / 32768;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function hexA(hex, alpha) {
    var h = hex.replace('#', '');
    if (h.length === 3) h = h.split('').map(function (c) { return c + c; }).join('');
    var r = parseInt(h.substring(0, 2), 16);
    var g = parseInt(h.substring(2, 4), 16);
    var b = parseInt(h.substring(4, 6), 16);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
  }

  // ── Mount ────────────────────────────────────────────────────────────────

  function mount() {
    var host = document.createElement('div');
    host.id = 'webcrew-ai-widget-host';
    document.body.appendChild(host);
    var shadow = host.attachShadow({ mode: 'open' });

    var style = document.createElement('style');
    style.textContent =
      '*{box-sizing:border-box;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;}' +
      '.launcher{position:fixed;bottom:24px;' + SIDE + ':24px;z-index:2147483000;width:60px;height:60px;border-radius:50%;border:none;cursor:pointer;' +
        'background:radial-gradient(circle at 35% 30%,#1c2b4a,' + DARK + ');box-shadow:0 8px 30px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;}' +
      '.launcher.active{animation:wc-pulse 1.6s ease-out infinite;}' +
      '@keyframes wc-pulse{0%{box-shadow:0 0 0 0 ' + hexA(ACCENT, 0.45) + ';}100%{box-shadow:0 0 0 14px ' + hexA(ACCENT, 0) + ';}}' +
      '.dot{width:9px;height:9px;border-radius:50%;background:#fff;transition:transform .12s ease;}' +
      '.dot.speaking{background:' + ACCENT + ';transform:scale(1.5);}' +
      '.panel{position:fixed;bottom:24px;' + SIDE + ':24px;z-index:2147483000;width:min(360px,calc(100vw - 32px));' +
        'max-height:min(560px,calc(100vh - 48px));display:flex;flex-direction:column;background:#fff;border-radius:20px;' +
        'box-shadow:0 20px 60px rgba(0,0,0,.25);overflow:hidden;}' +
      '.header{background:' + DARK + ';padding:16px 18px;display:flex;align-items:center;gap:12px;}' +
      '.avatar{width:40px;height:40px;border-radius:50%;background:rgba(255,255,255,.1);display:flex;align-items:center;justify-content:center;flex-shrink:0;}' +
      '.title{color:#fff;font-weight:700;font-size:14px;}' +
      '.status{color:rgba(255,255,255,.65);font-size:12px;}' +
      '.mode-switch{display:flex;background:#eef2f6;border-radius:999px;padding:3px;margin:12px 14px 0;gap:3px;}' +
      '.mode-btn{flex:1;border:0;border-radius:999px;padding:8px 10px;background:transparent;color:#64748b;font-weight:700;font-size:12px;cursor:pointer;}' +
      '.mode-btn.active{background:#fff;color:' + DARK + ';box-shadow:0 2px 8px rgba(15,23,42,.12);}' +
      '.close{background:transparent;border:none;color:rgba(255,255,255,.75);cursor:pointer;font-size:18px;padding:4px;line-height:1;}' +
      '.body{flex:1;overflow-y:auto;padding:14px 16px;display:flex;flex-direction:column;gap:8px;min-height:160px;}' +
      '.empty{color:#94a3b8;font-size:13px;text-align:center;margin-top:24px;}' +
      '.bubble{border-radius:14px;padding:8px 12px;font-size:13.5px;line-height:1.45;max-width:85%;white-space:pre-wrap;word-break:break-word;}' +
      '.bubble.ai{align-self:flex-start;background:#f1f5f9;color:#0f172a;}' +
      '.bubble.visitor{align-self:flex-end;background:' + ACCENT + ';color:#fff;}' +
      '.err{color:#b91c1c;font-size:13px;text-align:center;margin-top:8px;}' +
      '.footer{border-top:1px solid #e2e8f0;padding:10px;display:flex;gap:8px;align-items:center;}' +
      '.mic-btn{width:38px;height:38px;border-radius:50%;border:none;flex-shrink:0;cursor:pointer;font-size:16px;' +
        'display:flex;align-items:center;justify-content:center;background:#e2e8f0;color:#64748b;}' +
      '.mic-btn.on{background:' + ACCENT + ';color:#fff;}' +
      '.text-input{flex:1;border:1px solid #e2e8f0;border-radius:100px;padding:9px 14px;font-size:13.5px;outline:none;min-width:0;' +
        'color:#0f172a;background:#fff;caret-color:' + ACCENT + ';}' +
      '.send-btn{width:38px;height:38px;border-radius:50%;border:none;background:' + DARK + ';color:#fff;font-size:15px;' +
        'display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;}' +
      '.hidden{display:none!important;}';
    shadow.appendChild(style);

    var launcher = document.createElement('button');
    launcher.className = 'launcher';
    launcher.setAttribute('aria-label', 'Chat with ' + LABEL);
    launcher.innerHTML = '<span class="dot" data-role="launcher-dot"></span>';
    shadow.appendChild(launcher);

    var panel = document.createElement('div');
    panel.className = 'panel hidden';
    panel.innerHTML =
      '<div class="header">' +
        '<div class="avatar"><span class="dot" data-role="header-dot"></span></div>' +
        '<div style="flex:1;min-width:0">' +
          '<div class="title">' + escapeHtml(LABEL) + '</div>' +
          '<div class="status" data-role="status">Connecting…</div>' +
        '</div>' +
        '<button class="close" aria-label="Close" data-role="close">✕</button>' +
      '</div>' +
      '<div class="mode-switch" role="tablist" aria-label="Conversation mode">' +
        '<button class="mode-btn active" data-role="chat-mode" role="tab">⌨ Chat</button>' +
        '<button class="mode-btn" data-role="voice-mode" role="tab">🎤 Talk</button>' +
      '</div>' +
      '<div class="body" data-role="body">' +
        '<div class="empty" data-role="empty">Hi — I’m Virginia Mechanical’s virtual comfort assistant. How can I help today?</div>' +
      '</div>' +
      '<div class="footer">' +
        '<button class="mic-btn" data-role="mic" aria-label="Toggle microphone">🎤</button>' +
        '<input class="text-input" data-role="input" placeholder="Type a message…" />' +
        '<button class="send-btn" data-role="send" aria-label="Send">➤</button>' +
      '</div>';
    shadow.appendChild(panel);

    var $ = function (role) { return panel.querySelector('[data-role="' + role + '"]'); };
    var bodyEl = $('body'), emptyEl = $('empty'), statusEl = $('status'), micBtn = $('mic'), inputEl = $('input'), sendBtn = $('send'), closeBtn = $('close');
    var chatModeBtn = $('chat-mode'), voiceModeBtn = $('voice-mode');
    var launcherDot = launcher.querySelector('[data-role="launcher-dot"]');
    var headerDot = $('header-dot');

    // ── State ────────────────────────────────────────────────────────────────

    var status = 'idle'; // idle | connecting | listening | speaking | error | ended
    var open = false;
    var ws = null;
    var playbackCtx = null;
    var nextPlayTime = 0;
    var captureCtx = null;
    var stream = null;
    var processor = null;
    var turnstileToken = '';
    var mode = 'chat';
    var voiceUnlocked = false;

    function setStatus(s) {
      status = s;
      var text = { connecting: 'Connecting…', listening: 'Listening — say hi, or type below', speaking: 'Speaking…', error: 'Unavailable', ended: 'Chat ended', idle: 'Starting…' }[s] || s;
      statusEl.textContent = text;
      launcher.className = 'launcher' + (s === 'listening' || s === 'speaking' || s === 'connecting' ? ' active' : '');
      setSpeaking(s === 'speaking');
    }

    function setSpeaking(on) {
      launcherDot.className = 'dot' + (on ? ' speaking' : '');
      headerDot.className = 'dot' + (on ? ' speaking' : '');
    }

    function addBubble(role, text) {
      emptyEl.classList.add('hidden');
      var last = bodyEl.lastElementChild;
      if (last && last.dataset && last.dataset.role === role && last.classList.contains('bubble')) {
        last.textContent += text;
      } else {
        var b = document.createElement('div');
        b.className = 'bubble ' + role;
        b.dataset.role = role;
        b.textContent = text;
        bodyEl.appendChild(b);
      }
      bodyEl.scrollTop = bodyEl.scrollHeight;
    }

    function showError(message) {
      var e = document.createElement('div');
      e.className = 'err';
      e.textContent = message || 'Something went wrong.';
      bodyEl.appendChild(e);
      bodyEl.scrollTop = bodyEl.scrollHeight;
    }

    function teardown() {
      if (ws) { try { ws.close(); } catch (e) {} }
      ws = null;
      if (processor) { try { processor.disconnect(); } catch (e) {} }
      processor = null;
      if (stream) { stream.getTracks().forEach(function (t) { t.stop(); }); }
      stream = null;
      if (captureCtx) { captureCtx.close().catch(function () {}); }
      captureCtx = null;
      if (playbackCtx) { playbackCtx.close().catch(function () {}); }
      playbackCtx = null;
      micBtn.classList.remove('on');
    }

    function getTurnstileToken() {
      if (!TURNSTILE_SITE_KEY) return Promise.resolve('');
      return new Promise(function (resolve) {
        function render() {
          var container = document.createElement('div');
          document.body.appendChild(container);
          window.turnstile.render(container, {
            sitekey: TURNSTILE_SITE_KEY,
            size: 'invisible',
            callback: function (token) { resolve(token); container.remove(); },
          });
          setTimeout(function () { resolve(''); }, 8000);
        }
        if (window.turnstile) { render(); return; }
        var script = document.createElement('script');
        script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
        script.async = true;
        script.onload = render;
        script.onerror = function () { resolve(''); };
        document.head.appendChild(script);
      });
    }

    function startSession() {
      setStatus('connecting');

      getTurnstileToken().then(function (token) {
        turnstileToken = token;

        var AudioCtx = window.AudioContext || window.webkitAudioContext;
        playbackCtx = new AudioCtx();
        nextPlayTime = playbackCtx.currentTime;

        ws = new WebSocket(WS_URL);

        ws.onopen = function () {
          ws.send(JSON.stringify({ type: 'start', turnstileToken: turnstileToken }));
        };

        ws.onmessage = function (event) {
          var msg;
          try { msg = JSON.parse(event.data); } catch (e) { return; }
          if (msg.type === 'ready') {
            setStatus('listening');
          } else if (msg.type === 'audio') {
            if (mode === 'voice' && voiceUnlocked) playChunk(msg.data);
          } else if (msg.type === 'text') {
            addBubble(msg.role, msg.text);
          } else if (msg.type === 'interrupted') {
            nextPlayTime = playbackCtx.currentTime;
          } else if (msg.type === 'error') {
            showError(msg.message);
            setStatus('error');
          } else if (msg.type === 'closed') {
            setStatus('ended');
          }
        };
        ws.onerror = function () { showError('Connection error.'); setStatus('error'); };
        ws.onclose = function (event) {
          teardown();
          if (event.code !== 1000) {
            showError(event.reason || 'Connection closed unexpectedly.');
            setStatus('error');
          } else if (status !== 'error') {
            setStatus('ended');
          }
        };
      }).catch(function () {
        showError('Could not connect. You can still type below.');
        setStatus('error');
      });
    }

    function startMic() {
      if (stream) return;
      navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1 } }).then(function (s) {
        stream = s;
        var AudioCtx = window.AudioContext || window.webkitAudioContext;
        captureCtx = new AudioCtx();
        var source = captureCtx.createMediaStreamSource(stream);
        processor = captureCtx.createScriptProcessor(4096, 1, 1);
        processor.onaudioprocess = function (e) {
          if (!ws || ws.readyState !== WebSocket.OPEN) return;
          var input = e.inputBuffer.getChannelData(0);
          var down = downsampleTo16k(input, captureCtx.sampleRate);
          var pcm = floatTo16BitPCM(down);
          ws.send(JSON.stringify({ type: 'audio', data: int16ToBase64(pcm) }));
        };
        source.connect(processor);
        processor.connect(captureCtx.destination);
        micBtn.classList.add('on');
      }).catch(function (e) {
        showError(e && e.name === 'NotAllowedError' ? 'Microphone access was denied. You can still type below.' : 'Could not start the microphone. You can still type below.');
      });
    }

    function stopMic() {
      if (processor) { try { processor.disconnect(); } catch (e) {} }
      processor = null;
      if (stream) { stream.getTracks().forEach(function (t) { t.stop(); }); }
      stream = null;
      if (captureCtx) { captureCtx.close().catch(function () {}); }
      captureCtx = null;
      micBtn.classList.remove('on');
    }

    function playChunk(base64Pcm24) {
      if (!playbackCtx) return;
      var pcm = base64ToInt16(base64Pcm24);
      setSpeaking(rmsOf(pcm) > 0.01);
      setStatus('speaking');

      var float32 = new Float32Array(pcm.length);
      for (var i = 0; i < pcm.length; i++) float32[i] = pcm[i] / 32768;
      var buffer = playbackCtx.createBuffer(1, float32.length, 24000);
      buffer.copyToChannel(float32, 0);

      var src = playbackCtx.createBufferSource();
      src.buffer = buffer;
      src.connect(playbackCtx.destination);
      var startAt = Math.max(playbackCtx.currentTime, nextPlayTime);
      src.start(startAt);
      var endsAt = startAt + buffer.duration;
      nextPlayTime = endsAt;
      src.onended = function () {
        if (playbackCtx.currentTime >= nextPlayTime - 0.02) {
          setSpeaking(false);
          if (status === 'speaking') setStatus('listening');
        }
      };
    }

    function sendText() {
      var text = inputEl.value.trim();
      if (!text || !ws || ws.readyState !== WebSocket.OPEN) return;
      ws.send(JSON.stringify({ type: 'text', text: text }));
      addBubble('visitor', text);
      inputEl.value = '';
    }

    function toggleMic() {
      if (mode !== 'voice') { setMode('voice'); return; }
      if (stream) { stopMic(); }
      else if (ws && ws.readyState === WebSocket.OPEN) { voiceUnlocked = true; playbackCtx.resume().catch(function () {}); startMic(); }
      else { openWidget(); }
    }

    function setMode(next) {
      mode = next;
      chatModeBtn.classList.toggle('active', next === 'chat');
      voiceModeBtn.classList.toggle('active', next === 'voice');
      inputEl.disabled = next === 'voice';
      inputEl.placeholder = next === 'voice' ? 'Voice mode is active…' : 'Type a message…';
      if (next === 'chat') {
        stopMic();
        statusEl.textContent = ws && ws.readyState === WebSocket.OPEN ? 'Online · Chat mode' : 'Connecting…';
        inputEl.focus();
      } else {
        voiceUnlocked = true;
        if (playbackCtx) playbackCtx.resume().catch(function () {});
        statusEl.textContent = 'Voice mode · microphone on';
        if (ws && ws.readyState === WebSocket.OPEN) startMic();
      }
    }

    function openWidget() {
      open = true;
      panel.classList.remove('hidden');
      launcher.classList.add('hidden');
      if (status === 'idle' || status === 'ended' || status === 'error') startSession();
    }

    function closeWidget() {
      if (status === 'listening' || status === 'speaking' || status === 'connecting') {
        if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'stop' }));
      }
      teardown();
      setStatus('idle');
      open = false;
      panel.classList.add('hidden');
      launcher.classList.remove('hidden');
    }

    launcher.addEventListener('click', openWidget);
    closeBtn.addEventListener('click', closeWidget);
    micBtn.addEventListener('click', toggleMic);
    chatModeBtn.addEventListener('click', function () { setMode('chat'); });
    voiceModeBtn.addEventListener('click', function () { setMode('voice'); });
    sendBtn.addEventListener('click', sendText);
    inputEl.addEventListener('keydown', function (e) { if (e.key === 'Enter') sendText(); });
    window.addEventListener('beforeunload', teardown);
  }

  function boot() { mount(); if (AUTO_OPEN) setTimeout(function () {
    var host = document.getElementById('webcrew-ai-widget-host');
    var launcher = host && host.shadowRoot && host.shadowRoot.querySelector('.launcher');
    if (launcher) launcher.click();
  }, 650); }
  if (document.readyState === 'complete' || document.readyState === 'interactive') boot();
  else document.addEventListener('DOMContentLoaded', boot);
})();
