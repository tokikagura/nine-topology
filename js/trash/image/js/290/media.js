  function generateHighlightGIF() {
    if (boardSnapshots.length < 2) return;
    logMessage("【GIF抽出】ハイライトアニメーション生成中...");
    const canvas = document.getElementById('video-canvas');
    const ctx = canvas.getContext('2d');
    const stream = canvas.captureStream(30);

    let options = { mimeType: 'image/gif' };
    if (!MediaRecorder.isTypeSupported('image/gif')) options = { mimeType: 'video/webm' };

    const mediaRecorder = new MediaRecorder(stream, options);
    const recordedChunks = [];
    mediaRecorder.ondataavailable = e => { if (e.data.size > 0) recordedChunks.push(e.data); };
    mediaRecorder.onstop = () => {
      const blob = new Blob(recordedChunks, { type: 'image/gif' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `NineTopology_v2.5.3_Highlight.gif`;
      a.click();
      URL.revokeObjectURL(url);
      logMessage(`【GIF抽出完了】ローカルデポジット成功！`);
    };

    mediaRecorder.start();
    const slice = boardSnapshots.slice(Math.max(0, boardSnapshots.length - 12));
    let frame = 0;
    const interval = setInterval(() => {
      if (frame >= slice.length) {
        clearInterval(interval);
        setTimeout(() => mediaRecorder.stop(), 500);
        return;
      }
      drawBoardToCanvas(ctx, slice[frame].board);
      frame++;
    }, 700);
  }

  // v2.5.3変更点: ガス局面で配置候補ごとの自軍・敵軍中立化数を予測し、被害の少ない手を選択。
  // ガス中の内蔵BOTはランダムスライドを避け、安全形を維持する。
  function drawBoardToCanvas(ctx, boardData) {
    ctx.fillStyle = "#1f2833"; ctx.fillRect(0, 0, 324, 324);
    ctx.strokeStyle = "#66fcf1"; ctx.lineWidth = 3; ctx.strokeRect(0, 0, 324, 324);
    for (let b = 0; b < 9; b++) {
      const bx = (b % 3) * 108 + 4, by = Math.floor(b / 3) * 108 + 4;
      ctx.fillStyle = "#0b0c10"; ctx.fillRect(bx, by, 100, 100);
      for (let c = 0; c < 9; c++) {
        const cx = bx + (c % 3) * 33 + 1, cy = by + Math.floor(c / 3) * 33 + 1;
        ctx.fillStyle = "#1f2833"; ctx.fillRect(cx, cy, 32, 32);
        const stone = boardData[b][c];
        if (stone) {
          ctx.beginPath(); ctx.arc(cx + 16, cy + 16, 13, 0, Math.PI * 2);
          if (stone === 'white') ctx.fillStyle = "#ffffff";
          else if (stone === 'black') ctx.fillStyle = "#4b5d67";
          else if (stone === 'red') ctx.fillStyle = "#ff0055";
          else if (stone === 'blue') ctx.fillStyle = "#00d2ff";
          else if (stone === 'neutral') ctx.fillStyle = "#73787d";
          else if (stone === 'blue-reserved') ctx.fillStyle = "rgba(0,210,255,0.35)";
          ctx.fill();
        }
      }
    }
  }
