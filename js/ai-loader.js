(function () {
  'use strict';

  const MANIFEST_URL = 'ai/manifest.json';
  let manifest = null;

  function byId(id) {
    return document.getElementById(id);
  }

  function setLoaderStatus(message, isError = false) {
    const el = byId('ai-loader-status');
    if (!el) return;
    el.textContent = message;
    el.style.color = isError ? '#ff6b8a' : '#00d2ff';
  }

  function createOption(model) {
    const option = document.createElement('option');
    option.value = model.id;
    option.textContent = `${model.latest ? '★ ' : ''}${model.name}${model.version ? ` (${model.version})` : ''}`;
    return option;
  }

  function populateSelect(select, data) {
    select.innerHTML = '';
    for (const group of data.groups || []) {
      const optgroup = document.createElement('optgroup');
      optgroup.label = group.label || group.id;
      for (const model of group.models || []) {
        optgroup.appendChild(createOption(model));
      }
      if (optgroup.children.length > 0) select.appendChild(optgroup);
    }
  }

  function findModel(id) {
    for (const group of manifest?.groups || []) {
      const model = (group.models || []).find(item => item.id === id);
      if (model) return model;
    }
    return null;
  }

  async function fetchManifest() {
    const response = await fetch(`${MANIFEST_URL}?v=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`manifest.json: HTTP ${response.status}`);
    const data = await response.json();
    if (!Array.isArray(data.groups)) throw new Error('manifest.json の groups が不正です');
    return data;
  }

  async function fetchNtai(model) {
    if (model.type === 'builtin') return '';
    if (model.type !== 'ntai' || !model.file) {
      throw new Error(`${model.name}: type または file が不正です`);
    }
    const response = await fetch(`${model.file}?v=${encodeURIComponent(model.version || '')}`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`${model.file}: HTTP ${response.status}`);
    return response.text();
  }

  function clearInjectedEngines() {
    if (typeof testBot !== 'undefined' && testBot.intervalId) testBot.stop('AI再設定のため停止');

    document.getElementById('ntai-script-white')?.remove();
    document.getElementById('ntai-script-black')?.remove();

    window.NTAI_Engine_White = null;
    window.NTAI_Engine_Black = null;
    window.NTAI_Engine = null;
  }

  function injectEngine(side, code, model) {
    if (model.type === 'builtin') return;

    const script = document.createElement('script');
    script.id = `ntai-script-${side}`;
    script.textContent = `
      (function () {
        window.NTAI_Engine = null;
        ${code}
        if (!window.NTAI_Engine || typeof window.NTAI_Engine.decideNextMove !== 'function') {
          throw new Error(${JSON.stringify(`${model.name}: NTAI_Engine.decideNextMove が見つかりません`)});
        }
        window.${side === 'white' ? 'NTAI_Engine_White' : 'NTAI_Engine_Black'} = window.NTAI_Engine;
        window.NTAI_Engine = null;
      })();
    `;
    document.body.appendChild(script);
  }

  function engineDisplayName(side, fallback) {
    const engine = side === 'white' ? window.NTAI_Engine_White : window.NTAI_Engine_Black;
    return engine?.name || fallback;
  }

  async function startSelectedBattle() {
    const startButton = byId('btn-start-selected-ai');
    const whiteModel = findModel(byId('ai-select-white')?.value);
    const blackModel = findModel(byId('ai-select-black')?.value);

    if (!whiteModel || !blackModel) {
      setLoaderStatus('白黒のAIを選択してください。', true);
      return;
    }

    startButton.disabled = true;
    setLoaderStatus('NTAIを読み込み中...');

    try {
      const [whiteCode, blackCode] = await Promise.all([
        fetchNtai(whiteModel),
        fetchNtai(blackModel)
      ]);

      clearInjectedEngines();
      initGame();
      injectEngine('white', whiteCode, whiteModel);
      injectEngine('black', blackCode, blackModel);

      const whiteName = engineDisplayName('white', whiteModel.name);
      const blackName = engineDisplayName('black', blackModel.name);
      setLoaderStatus(`White: ${whiteName} / Black: ${blackName}`);
      logMessage(`【AI選択】白=${whiteName} / 黒=${blackName}`);

      externalDuelAutoStarted = true;
      testBot.start();
    } catch (error) {
      clearInjectedEngines();
      setLoaderStatus(`読込失敗: ${error.message}`, true);
      logMessage(`【NTAI読込エラー】${error.message}`);
    } finally {
      startButton.disabled = false;
    }
  }

  async function initializeSelector() {
    try {
      setLoaderStatus('AI名簿を読み込み中...');
      manifest = await fetchManifest();
      populateSelect(byId('ai-select-white'), manifest);
      populateSelect(byId('ai-select-black'), manifest);

      const white = byId('ai-select-white');
      const black = byId('ai-select-black');
      if (white.options.length > 0) white.selectedIndex = 0;
      if (black.options.length > 1) black.selectedIndex = 1;
      else if (black.options.length > 0) black.selectedIndex = 0;

      byId('btn-start-selected-ai').disabled = false;
      setLoaderStatus(`AI名簿: ${manifest.ruleVersion || 'unknown'} / ${white.options.length}体`);
    } catch (error) {
      setLoaderStatus(`AI名簿の読込失敗: ${error.message}`, true);
    }
  }

  window.startSelectedBattle = startSelectedBattle;
  window.addEventListener('DOMContentLoaded', initializeSelector);
})();
