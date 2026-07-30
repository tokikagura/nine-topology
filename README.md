# Nine Topology — Quick Rule Guide  
  
---  
  
## 1. 日本語版 (Japanese)  
  
### 概要 (Overview)  
`Nine Topology`（ナイン・トポロジー）は、3×3の9つのブロック（全81マス）で構成された動的盤面で戦う抽象戦略ゲームです。石の「配置」とブロックの「スライド移動」を駆使し、囲碁のような呼吸点（Liberties）包囲による石の回収ポイントを競います。  
  
### ゲームの流れ (Game Flow)  
  
#### ① 準備フェーズ（1〜4手目）  
* **四隅配置**: 先手・後手が交互に、四隅のブロック（B1, B3, B7, B9）へ任意の1マスに1石ずつ初期石をデポジットします。  
  
#### ② メインフェーズ（本戦ターン1以降）  
手番プレイヤーは以下の順でアクションを行います：  
1. **配置 (Place)**: 空きマスに自分の石を1つ配置します。  
2. **スライド (Slide)**: 任意のブロックを1つ選んで上下左右にスライド移動させます（パスも可能）。  
   * **スライドロック**: 捕獲が発生したターン、または盤面の空きマスが15以下になるとスライドは実行できません。  
  
### 特殊エレメント (Special Elements)  
  
* **赤石 (絶対障壁 / Red Wall)**  
  * 各プレイヤーが保持する設置型の障壁（白3個 / 黒4個）。  
  * 配置時に「シークレット申告」を行うことで、**2ターン後の自分の手番時**に出現します。  
  * 赤石は誰の石でもなく、連結や呼吸点を持たない「絶対的な障害物」として機能します。  
  
* **青石 (環境イベント / Blue Stone Drop)**  
  * ゲーム開始時、**B6（中右）** に予告枠（Reserved）が表示されています（四隅の布石を阻害しません）。  
  * **5ターン目開始時**、予告地から **B7（左下）** の中央セル（b2）へ破断ワープ降臨します。  
  * 既存の石がある場合でも**絶対上書き（消滅）**してドロップします。回収すると **2pt**（通常石は1pt）を獲得できます。  
  
### 捕獲と勝利条件 (Captures & Win Condition)  
  
* **捕獲 (Capture)**: 敵石または青石の上下左右の「呼吸点」をすべて自分の石や赤石で塞ぐと捕獲成功となり、盤面から回収してポイントを獲得します。  
* **自滅手 (Suicide Move)**: 置いた瞬間に自分の呼吸点が0になるマスへの着手は禁止です（相手の石を同時に捕獲できる場合を除く）。  
* **勝利条件**: 盤面が埋まるか着手不能（詰み）になった時点で対局終了。より多くのポイント（回収した石）を獲得したプレイヤーの勝利となります。  
  
---  
  
## 2. English Version  
  
### Overview  
`Nine Topology` is a dynamic abstract strategy game played on a grid of 9 sliding 3x3 blocks (81 cells in total). Players compete for points by capturing stones through "Liberties" surrounding mechanisms—combining strategic placement with tactical board manipulation.  
  
### Game Flow  
  
#### 1. Setup Phase (Moves 1–4)  
* **Corner Deposit**: Players take turns depositing 1 initial stone into any cell within each of the four corner blocks (B1, B3, B7, B9).  
  
#### 2. Main Phase (Move 5 / Turn 1 onwards)  
On your turn, perform the following actions in order:  
1. **Place**: Put one of your stones onto any empty cell.  
2. **Slide**: Choose one 3x3 block and slide it Up, Down, Left, or Right (Passing is allowed).  
   * **Slide Lock**: Sliding is disabled if a capture occurs on that turn or when remaining empty cells are 15 or fewer.  
  
### Special Elements  
  
* **Red Stone (Absolute Wall)**  
  * A deployable barrier stock (White: 3, Black: 4).  
  * Declared as a "Secret Reservation" during placement and **appears after 2 turns** on your move.  
  * Acts as an impassable obstacle belonging to neither player and possesses no liberties.  
  
* **Blue Stone (Environmental Event)**  
  * At game start, a reservation marker appears on **B6 (Middle-Right)**, leaving corner setups unhindered.  
  * At the start of **Turn 5**, the Blue Stone warps and drops into the center cell (b2) of **B7 (Bottom-Left)**.  
  * Overwrites and destroys any existing stone on that cell upon landing. Capturing it yields **2 pt** (standard stones yield 1 pt).  
  
### Captures & Win Condition  
  
* **Capture**: Completely surround all liberties (adjacent vertical/horizontal space) of opponent stones or the Blue Stone with your own stones or Red Walls to collect them for points.  
* **Suicide Restriction**: Placing a stone in a position with zero liberties is illegal, unless that placement simultaneously results in a capture.  
* **Win Condition**: The game ends when no legal moves remain or the board is full. The player with the highest score wins.  
