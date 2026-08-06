  function sanitizeHeaderValue(value) {
    return String(value ?? '')
      .replace(/[\r\n]+/g, ' ')
      .replace(/"/g, "'");
  }

  function sanitizeFilePart(value) {
    const cleaned = String(value ?? '')
      .replace(/[^0-9A-Za-z._-]+/g, '_')
      .replace(/^_+|_+$/g, '');
    return cleaned || 'Default';
  }

  function downloadNtpnFile() {
    const now = new Date();
    const yyyy = String(now.getFullYear());
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');

    const dateStr = `${yyyy}-${mm}-${dd}`;
    const timeStr = `${hh}:${min}`;
    const compactStamp = `${yyyy.slice(2)}${mm}${dd}_${hh}${min}`;

    const whiteEngine = window.NTAI_Engine_White || null;
    const blackEngine = window.NTAI_Engine_Black || null;
    const whiteName = sanitizeHeaderValue(whiteEngine && whiteEngine.name ? whiteEngine.name : 'Default_Bot_White');
    const blackName = sanitizeHeaderValue(blackEngine && blackEngine.name ? blackEngine.name : 'Default_Bot_Black');

    let outcome = '*';
    if (gameEndInfo.winner === 'White') outcome = '1-0';
    else if (gameEndInfo.winner === 'Black') outcome = '0-1';
    else if (gameEndInfo.winner === 'Draw') outcome = '1/2-1/2';

    const recordedTurns = gameEndInfo.turns ?? ntpnMoveHistory.length;
    const detailLine = gameEndInfo.detail
      ? `[Detail "${sanitizeHeaderValue(gameEndInfo.detail)}"]\n`
      : '';

    // v2.8系の青石保護情報は、その機能を持つマップでのみ出力する。
    // 標準マップ（v2.7.2）では変数自体が存在しないため、ヘッダを増やさない。
    let blueRuleLines = '';
    if (typeof blueStonesSecured !== 'undefined' && typeof blueProtectionRemaining !== 'undefined') {
      blueRuleLines =
        `[BlueSecured "W:${blueStonesSecured.white} B:${blueStonesSecured.black}"]\n` +
        `[BlueProtectionRemaining "W:${blueProtectionRemaining.white} B:${blueProtectionRemaining.black}"]\n`;
    }

    let ntpnContent =
      `[Game "Nine Topology"]\n` +
      `[GameVersion "2.7.2"]\n` +
      `[Date "${dateStr}"]\n` +
      `[Time "${timeStr}"]\n` +
      `[White "${whiteName}"]\n` +
      `[Black "${blackName}"]\n` +
      `[Winner "${gameEndInfo.winner}"]\n` +
      `[Outcome "${outcome}"]\n` +
      `[Result "${playerScores.white}-${playerScores.black}"]\n` +
      blueRuleLines +
      `[Reason "${gameEndInfo.reason}"]\n` +
      `[Turns "${recordedTurns}"]\n` +
      detailLine +
      `\n`;

    ntpnMoveHistory.forEach(m => { ntpnContent += `${m}\n`; });

    // v2.8棋譜形式: 終局済みの場合、末尾へ機械可読な終局イベントを追加する。
    if (gameEndInfo.winner !== 'IN_PROGRESS') {
      ntpnContent +=
        `[EVENT:GAME_END reason=${gameEndInfo.reason} winner=${gameEndInfo.winner} ` +
        `outcome=${outcome} result=${playerScores.white}-${playerScores.black} turns=${recordedTurns}]\n`;
    }

    const blob = new Blob([ntpnContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download =
      `${compactStamp}_${sanitizeFilePart(whiteName)}-${sanitizeFilePart(blackName)}.ntpn`;
    a.click();
    URL.revokeObjectURL(url);
    logMessage(`対戦記譜(.ntpn)を保存完了！ ${a.download}`);
  }
