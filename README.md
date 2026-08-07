# Nine Topology

Quick Rule Guide for Game Version v2.7.2

This README summarizes the official v2.7.2 ruleset. It is not an AI API specification. Features from the separate v2.8 test ruleset are not included here.

## Legacy NTAI Downloads / レガシーNTAI ダウンロード

Older NTAI engines for development matches and reference testing.  
自作NTAIの開発対局・比較テスト用に、旧世代のNTAIを公開しています。

- [GPT — GPT_Alpha_v9.ntai](./ai/models/legacy/GPT_Alpha_v9.ntai)
- [Claude — claude-topologist_v8.ntai](./ai/models/legacy/claude-topologist_v8.ntai)
- [Gemini — Gemini_Alpha_v10.ntai](./ai/models/legacy/Gemini_Alpha_v10.ntai)
- [Grok — Grok_Alpha_v15.ntai](./ai/models/legacy/Grok_Alpha_v15.ntai)

## English

### 1. Overview

Nine Topology is an AI-versus-AI abstract strategy game played on one continuous 9 × 9 board divided into nine 3 × 3 blocks.

- White moves first.
- Black moves second.
- Players score by capturing opposing stones.
- A normal turn usually contains one placement action followed by one optional block slide.
- The Blue Stone, delayed Red Stones, Gas, and simultaneous capture resolution can alter the board during play.

The nine blocks are not separate mini-boards. Orthogonal adjacency, groups, liberties, and captures continue across block borders.

### 2. Board and Coordinates

#### Block layout

```
B1  B2  B3
B4  B5  B6
B7  B8  B9
```

#### Cell layout inside each block

```
a1  b1  c1
a2  b2  c2
a3  b3  c3
```

Examples:

- B1-a1: upper-left cell of B1
- B5-b2: centre cell of B5
- B9-c3: lower-right cell of B9

Only orthogonal adjacency counts. Diagonal contact does not connect stones.

### 3. Setup Phase

Four setup placements occur before numbered turns begin:

1. White
2. Black
3. White
4. Black

Setup rules:

- Setup stones may be placed only in B1, B3, B7, or B9.
- Each target must be empty.
- A player may not place both of their setup stones in the same block.
- White and Black may use the same corner block because the restriction is applied separately to each player.
- Red Stone declarations are not available.
- No block slide occurs.
- B3-b2 begins as the reserved Blue position and is not an empty setup target.

After the fourth setup placement, normal turn 1 begins with White.

### 4. Normal Turn Sequence

A normal turn is resolved in this order:

1. Resolve any Red Stones scheduled for the current turn.
2. Resolve captures caused by each Red Stone appearance.
3. On turn 5, resolve the Blue Stone activation event.
4. Choose one placement action:
   - place one normal stone; or
   - declare one Red Stone, if any remain.
5. Resolve captures caused by a normal stone placement.
6. If that placement captured at least one stone, skip the slide phase.
7. Otherwise, slide one block by one cell or pass.
8. Resolve captures caused by the slide.
9. Process Gas at the end of the turn.
10. Record the turn and pass play to the other player.

A decisive capture can end the game before later turn effects are processed.

### 5. Normal Placement, Liberties, and Capture

A normal stone may be placed only when:

- the target cell is genuinely empty;
- the move is not suicide; and
- the move does not recreate the prohibited simple-Ko position.

A suicide placement is illegal unless it simultaneously captures an adjacent opposing group or Blue group and thereby creates a liberty.

A group is made of orthogonally connected stones of the same type:

- White connects only to White.
- Black connects only to Black.
- Blue connects only to Blue.

A liberty is an orthogonally adjacent empty cell. Only an actually empty cell counts as a liberty.

Scoring:

- Each captured opposing White or Black stone is worth 1 point.
- A captured Blue Stone is worth 5 points.

After a slide or Red Stone appearance, all zero-liberty White, Black, and Blue groups are identified from the same board position and removed simultaneously. A player may lose their own stones because of their own slide.

### 6. Block Slides

If a normal placement does not capture anything, the player may slide one block or pass.

A slide shifts all contents inside one selected 3 × 3 block by one cell with wraparound:

- Left: the leftmost cell of each row wraps to the right.
- Right: the rightmost cell of each row wraps to the left.
- Up: the top cell of each column wraps to the bottom.
- Down: the bottom cell of each column wraps to the top.

The block itself does not move to another B1–B9 position. Only its contents cycle.

Everything inside the selected block moves with the slide, including:

- White and Black stones;
- the active Blue Stone;
- the reserved Blue position;
- Red Stones;
- Neutral stones; and
- empty cells.

The official v2.7.2 ruleset has no active block-locking rule. All nine blocks are normally available during the slide phase.

### 7. Blue Stone

Nine Topology v2.7.2 uses one Blue Stone.

- At game start, the reserved Blue position occupies B3-b2.
- The reserved position is not a legal placement target and is not a liberty.
- It moves whenever B3 is slid.
- At the start of turn 5, it becomes an active Blue Stone at its current position inside B3.
- Because B3 may have been slid, the Blue Stone is not guaranteed to activate at B3-b2.
- Capturing the Blue Stone is worth 5 points.
- The Blue Stone does not count toward the 15-stone decisive-capture threshold.

A Red Stone may replace the reserved Blue position before turn 5. If that happens, the reserved marker disappears and the Blue Stone does not activate.

### 8. Red Stones

Each player begins with five Red Stone declarations.

To declare a Red Stone:

- use the placement action for the current turn;
- select a target that passes the current normal-placement legality check;
- place no normal White or Black stone;
- consume one Red Stone declaration; and
- schedule the Red Stone to appear on current turn + 2.

Example: a declaration on turn 7 is scheduled for turn 9.

After declaring a Red Stone, the player continues to the slide phase.

At the start of the scheduled turn:

- the Red Stone appears if the target is empty;
- it also appears if the target contains the reserved Blue position;
- it fails if the target contains a White, Black, active Blue, Red, or Neutral stone; and
- a failed declaration is not refunded.

A Red Stone:

- occupies its cell;
- is not a liberty;
- cannot be captured;
- gives no points; and
- moves with its block when that block is slid.

Immediately after a Red Stone appears, all zero-liberty White, Black, and Blue groups are resolved simultaneously. If the appearance captures the Blue Stone, the Red Stone's owner receives 5 points.

### 9. Gas and Neutral Stones

At the end of a turn, Gas activates when the number of genuinely empty cells first becomes 10 or fewer.

Once active, Gas is processed at the end of every later turn:

1. Identify all empty cells.
2. Inspect their four orthogonally adjacent cells.
3. Mark every adjacent White or Black stone.
4. Convert all marked stones to Neutral simultaneously.

Gas rules:

- Gas awards no points.
- Gas conversion is not a capture.
- Gas does not create an empty cell.
- There is no second-wave chain reaction during the same Gas step.
- Gas affects only White and Black stones.
- It does not affect the Blue Stone, Red Stones, the reserved Blue position, or existing Neutral stones.

A Neutral stone:

- remains on the board;
- occupies its cell and is not a liberty;
- gives no points;
- cannot be captured by the normal capture system; and
- moves with its block when that block is slid.

### 10. End Conditions

The game ends under any of the following conditions.

#### Decisive capture

If one capture resolution removes 15 or more White stones or 15 or more Black stones, the game ends immediately after the capture score is added.

The 15-stone loss is only an end trigger. It does not automatically determine the winner. The player with the higher cumulative score wins; equal scores produce a draw.

#### No legal placement

If the player to move has no legal normal placement target, the game ends immediately by cumulative score. No placement or slide is made for that turn.

#### Turn limit

Turn 128 is recorded normally. Immediately afterward, the game ends by cumulative score unless a decisive capture has already ended it.

### 11. Version Boundary

This README describes v2.7.2 only.

The following v2.8-test features are not part of v2.7.2:

- three Blue Stones;
- Blue Stones worth 0 points;
- Blue-based Gas protection;
- permanent Gas immunity;
- Blue events on turns 12 and 50; and
- v2.8-specific Blue/Gas state fields.

For engine registration, board indexing, gameState, move-return objects, and fallback behaviour, use the separate Nine Topology AI API Specification for v2.7.2.

---

## 日本語

### 1. 概要

Nine Topology（ナイン・トポロジー）は、9個の3×3ブロックに分かれた、連続した9×9盤面で行うAI対AIの抽象戦略ゲームです。

- 白が先手です。
- 黒が後手です。
- 相手の石を捕獲して得点を競います。
- 通常の手番は、原則として「配置アクション1回」と「任意のブロックスライド1回」で構成されます。
- 青石、遅延出現する赤石、ガス、同時捕獲処理によって盤面が変化します。

9個のブロックは独立した小盤ではありません。上下左右の隣接、連、呼吸点、捕獲判定はブロック境界を越えて連続します。

### 2. 盤面と座標

#### ブロック配置

```
B1  B2  B3
B4  B5  B6
B7  B8  B9
```

#### 各ブロック内のセル配置

```
a1  b1  c1
a2  b2  c2
a3  b3  c3
```

例：

- B1-a1：B1の左上
- B5-b2：B5の中央
- B9-c3：B9の右下

隣接として数えるのは上下左右のみです。斜めに接していても石はつながりません。

### 3. 準備フェーズ

通常ターンの開始前に、4回の初期配置を行います。

1. 白
2. 黒
3. 白
4. 黒

準備フェーズの規則：

- 初期石を置けるのはB1、B3、B7、B9の四隅ブロックのみです。
- 配置先は空きセルでなければなりません。
- 同じプレイヤーは、自分の2個の初期石を同じブロックへ置けません。
- この制限はプレイヤーごとに適用されるため、白と黒が同じ四隅ブロックを使うことはできます。
- 赤石の申告はできません。
- ブロックスライドは行いません。
- B3-b2には最初から青石予約位置があるため、空きセルとして初期配置できません。

4回目の初期配置後、白の通常ターン1から開始します。

### 4. 通常ターンの処理順

通常ターンは次の順序で処理します。

1. 現在のターンに出現予定の赤石を処理します。
2. 赤石出現による捕獲を処理します。
3. ターン5なら青石の出現イベントを処理します。
4. 次のどちらかの配置アクションを1回行います。
   - 通常石を1個置く
   - 残数があれば赤石を1個申告する
5. 通常石の配置による捕獲を処理します。
6. 通常石の配置で1個以上を捕獲した場合、スライドを省略します。
7. 捕獲がなければ、1ブロックを1セル分スライドするかパスします。
8. スライドによる捕獲を処理します。
9. ターン終了時のガス処理を行います。
10. ターンを記録し、相手へ手番を渡します。

大量捕獲の終了条件を満たした場合、後続のターン処理より先に対局が終了します。

### 5. 通常配置・呼吸点・捕獲

通常石を置けるのは、次の条件をすべて満たす場合だけです。

- 配置先が完全な空きセルである
- 自殺手ではない
- 禁止される単純コウの盤面を再現しない

置いた石の連の呼吸点が0になる手は原則として禁止です。ただし、その配置によって隣接する相手の連または青石を同時に捕獲し、呼吸点が生まれる場合は合法です。

「連」は、同じ種類の石が上下左右につながったまとまりです。

- 白は白とのみ連結します。
- 黒は黒とのみ連結します。
- 青石は青石とのみ連結します。

呼吸点は、上下左右に隣接する空きセルです。実際に空であるセルだけが呼吸点になります。

得点：

- 相手の白石または黒石を1個捕獲：1点
- 青石を捕獲：5点

スライドまたは赤石出現の後は、その時点の同一盤面から呼吸点0の白・黒・青の連をすべて特定し、同時に除去します。自分のスライドによって自分の石が失われることもあります。

### 6. ブロックスライド

通常石の配置で捕獲が起きなかった場合、プレイヤーは1ブロックをスライドするか、パスできます。

スライドでは、選択した3×3ブロック内の内容を1セル分、循環移動させます。

- 左：各行の左端セルが右端へ回り込みます。
- 右：各行の右端セルが左端へ回り込みます。
- 上：各列の上端セルが下端へ回り込みます。
- 下：各列の下端セルが上端へ回り込みます。

ブロックそのものがB1〜B9の別位置へ移動するわけではありません。移動するのはブロック内部の内容です。

選択したブロック内では、次のすべてがスライドとともに移動します。

- 白石・黒石
- 出現後の青石
- 青石予約位置
- 赤石
- 中立石
- 空きセル

公式v2.7.2では、ブロックロック規則は有効化されていません。通常は9ブロックすべてをスライド対象にできます。

### 7. 青石

Nine Topology v2.7.2では青石を1個使用します。

- ゲーム開始時、B3-b2は青石予約位置です。
- 青石予約位置には通常配置できず、呼吸点にもなりません。
- B3をスライドすると、青石予約位置も移動します。
- ターン5の開始時、青石予約位置はB3内の現在位置で青石になります。
- ターン1〜4にB3がスライドされていれば、青石がB3-b2に出現するとは限りません。
- 青石の捕獲は5点です。
- 青石は「15個以上の大量捕獲」による終了判定の個数には含めません。

ターン5より前に赤石が青石予約位置へ出現した場合、予約位置は赤石に置き換わります。その場合、青石予約マーカーは消滅し、青石は出現しません。

### 8. 赤石

各プレイヤーは、対局開始時に5回分の赤石申告権を持ちます。

赤石を申告する場合：

- そのターンの配置アクションを使用します。
- 現在の通常配置の合法判定を通るセルを対象にします。
- 白石または黒石は置きません。
- 赤石申告権を1回分消費します。
- 現在のターン + 2に出現予定として登録します。

例：ターン7に申告した赤石はターン9に出現予定です。

赤石を申告した後は、スライドフェーズへ進みます。

予定ターンの開始時：

- 対象セルが空なら赤石が出現します。
- 対象セルが青石予約位置でも赤石が出現します。
- 白石、黒石、出現後の青石、赤石、中立石のいずれかで占有されていれば失敗します。
- 失敗した申告権は返却されません。

赤石の性質：

- セルを占有します。
- 呼吸点にはなりません。
- 捕獲されません。
- 得点を与えません。
- 所属ブロックのスライドとともに移動します。

赤石の出現直後、呼吸点0の白・黒・青の連を同時に処理します。赤石出現によって青石を捕獲した場合、赤石の所有者が5点を得ます。

### 9. ガスと中立石

ターン終了時、完全な空きセルの数が初めて10以下になった時点でガスが発動します。

発動後は、以後の各ターン終了時にガス処理を行います。

1. すべての空きセルを特定します。
2. 各空きセルの上下左右を調べます。
3. 隣接する白石・黒石をすべて対象にします。
4. 対象石を同時に中立石へ変換します。

ガスの規則：

- 得点は発生しません。
- ガス変換は捕獲ではありません。
- 変換後もセルは空きになりません。
- 同じガス処理中に二次的な連鎖は発生しません。
- ガスが影響するのは白石と黒石だけです。
- 青石、赤石、青石予約位置、既存の中立石には影響しません。

中立石の性質：

- 盤上に残ります。
- セルを占有し、呼吸点にはなりません。
- 得点を与えません。
- 通常の捕獲処理では除去されません。
- 所属ブロックのスライドとともに移動します。

### 10. 終了条件

次のいずれかを満たすと対局終了です。

#### 大量捕獲

1回の捕獲処理で、白石が15個以上または黒石が15個以上除去された場合、捕獲得点を加算した直後に対局が終了します。

15個以上の損失は対局終了の引き金であり、それだけで勝者を決める規則ではありません。累計得点が高い側の勝利となり、同点なら引き分けです。

#### 合法配置なし

手番プレイヤーに合法な通常配置先が1つもない場合、そのターンの配置やスライドを行わず、累計得点で対局を終了します。

#### ターン上限

ターン128は通常どおり記録します。その直後、大量捕獲によってすでに終了していなければ、累計得点で対局を終了します。

### 11. バージョン境界

このREADMEはv2.7.2のみを説明しています。

次の要素はv2.8テスト版の仕様であり、v2.7.2には含まれません。

- 3個の青石
- 青石0点
- 青石によるガス防護
- 恒久的なガス耐性
- ターン12・50の青石イベント
- v2.8専用の青石・ガス関連状態フィールド

エンジン登録、盤面インデックス、gameState、指し手返却オブジェクト、フォールバック動作については、別文書のNine Topology AI API Specification for v2.7.2を参照してください。
