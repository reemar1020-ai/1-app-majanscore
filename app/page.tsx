"use client";

import { useState } from "react";
import { supabase } from "../lib/supabase";

// ===== 型定義 =====
type PlayerCount = 3 | 4;
type Tab = "setup" | "score" | "history";

type Settings = {
  playerCount: PlayerCount;
  names: string[];
  initialPoints: number;
  basePoints: number;
  pointRate: number;
  chipRate: number;
  uma: string[]; // string[] で保持（入力途中の "-" を許容するため）
};

type GameEntry = {
  finalPoints: string[]; // 最終持ち点（文字列管理 → 計算時に変換）
  chips: string[];       // チップ枚数（マイナス可）
};

type GameResult = {
  rank: number;
  rawScore: number;
  umaVal: number;
  finalScore: number;
  pointAmount: number;
  chipAmount: number;
  totalAmount: number;
};

// ===== 定数 =====
const UMA_DEFAULTS: Record<PlayerCount, string[]> = {
  4: ["20", "10", "-10", "-20"],
  3: ["15", "0", "-15"],
};
const RANK_LABELS = ["1位", "2位", "3位", "4位"];
const RANK_CLS = ["rank1", "rank2", "rank3", "rank4"];

// ===== 入力ヘルパー（iOS マイナス対応の核心部分） =====

/**
 * 整数（マイナス可）のみ許可するバリデーション。
 * 正規表現で数字と先頭の「-」だけ通す。
 * 例: "" → OK, "-" → OK（入力途中）, "-10" → OK, "1.5" → NG
 */
function allowNegInt(v: string): boolean {
  return /^-?\d*$/.test(v);
}

/**
 * 文字列 → 数値変換。
 * "-" や "" は 0 として扱う（計算時のNaN防止）。
 */
function toNum(v: string): number {
  if (v === "" || v === "-") return 0;
  return Number(v);
}

/**
 * ±ボタン用：符号を切り替える。
 * "10" → "-10"、"-10" → "10"、"" → "-"
 */
function toggleMinus(v: string): string {
  if (v.startsWith("-")) return v.slice(1); // マイナス除去
  if (v === "") return "-";                 // 空欄 → 入力開始
  return `-${v}`;                           // プラス → マイナス
}

// ===== ファクトリ =====
function makeSettings(n: PlayerCount): Settings {
  return {
    playerCount: n,
    names: Array.from({ length: n }, (_, i) => `プレイヤー${i + 1}`),
    initialPoints: 25000,
    basePoints: 30000,
    pointRate: 100,
    chipRate: 100,
    uma: [...UMA_DEFAULTS[n]],
  };
}

function makeGame(n: number): GameEntry {
  return { finalPoints: Array(n).fill(""), chips: Array(n).fill("") };
}

// ===== 計算ロジック =====
function calcGame(game: GameEntry, s: Settings): GameResult[] | null {
  // 空欄または入力途中の "-" があれば計算しない
  if (game.finalPoints.some((v) => v === "" || v === "-")) return null;

  const fp = game.finalPoints.map(toNum); // toNum で安全に数値変換
  const ch = game.chips.map(toNum);       // "-" や "" は 0 として扱う

  // 順位決定：持ち点降順、同点は入力順
  const rankOf: number[] = new Array(s.playerCount);
  fp.map((p, i) => ({ p, i }))
    .sort((a, b) => b.p - a.p || a.i - b.i)
    .forEach(({ i }, ri) => { rankOf[i] = ri + 1; });

  return fp.map((p, i) => {
    const raw = (p - s.basePoints) / 1000;
    const umaVal = toNum(s.uma[rankOf[i] - 1]); // ウマも toNum で変換
    const final = raw + umaVal;
    const pointAmt = Math.round(final * s.pointRate);
    const chipAmt = ch[i] * s.chipRate;
    return {
      rank: rankOf[i],
      rawScore: raw,
      umaVal,
      finalScore: final,
      pointAmount: pointAmt,
      chipAmount: chipAmt,
      totalAmount: pointAmt + chipAmt,
    };
  });
}

// ===== フォーマット =====
function fmtScore(n: number, unit = "") {
  const abs = Math.abs(n);
  const str = Number.isInteger(abs) ? String(abs) : abs.toFixed(1);
  return (n > 0 ? "+" : n < 0 ? "-" : "") + str + unit;
}

function fmtAmt(n: number) {
  return (n > 0 ? "+" : "") + n.toLocaleString() + "円";
}

// ===== ルートコンポーネント =====
export default function Home() {
  const [tab, setTab] = useState<Tab>("setup");
  const [settings, setSettings] = useState<Settings>(makeSettings(4));
  const [games, setGames] = useState<GameEntry[]>(() =>
    Array(5).fill(null).map(() => makeGame(4))
  );

  function changePlayerCount(n: PlayerCount) {
    setSettings(makeSettings(n));
    setGames(Array(5).fill(null).map(() => makeGame(n)));
  }

  function saveSettings() {
    if (settings.names.some((nm) => !nm.trim())) {
      alert("プレイヤー名を全員入力してください");
      return;
    }
    setTab("score");
  }

function updateGame(
  gIdx: number,
  field: "finalPoints" | "chips",
  pIdx: number,
  val: string
) {
  setGames((prev) =>
    prev.map((g, i) => {
      if (i !== gIdx) return g;
      const arr = [...g[field]];
      arr[pIdx] = val;
      return { ...g, [field]: arr };
    })
  );
}

async function saveGame(gIdx: number) {
  const game = games[gIdx];
  const result = calcGame(game, settings);

  if (!result) {
    alert("全員の最終持ち点を入力してください");
    return;
  }

  const expected = settings.initialPoints * settings.playerCount;

  const totalPoints = game.finalPoints.reduce(
    (sum, value) => sum + toNum(value),
    0
  );

  if (totalPoints !== expected) {
    alert("最終持ち点の合計が一致していません");
    return;
  }

  const row = {
    player_count: settings.playerCount,

    player1_name: settings.names[0],
    player1_score: toNum(game.finalPoints[0]),
    player1_chips: toNum(game.chips[0]),

    player2_name: settings.names[1],
    player2_score: toNum(game.finalPoints[1]),
    player2_chips: toNum(game.chips[1]),

    player3_name: settings.names[2],
    player3_score: toNum(game.finalPoints[2]),
    player3_chips: toNum(game.chips[2]),

    player4_name:
      settings.playerCount === 4 ? settings.names[3] : null,
    player4_score:
      settings.playerCount === 4 ? toNum(game.finalPoints[3]) : null,
    player4_chips:
      settings.playerCount === 4 ? toNum(game.chips[3]) : null,
  };

  const { error } = await supabase
    .from("mahjong_games")
    .insert(row);

  if (error) {
    console.error(error);
    alert("保存に失敗しました");
    return;
  }

  alert(`第${gIdx + 1}ゲームを保存しました`);
}

const allResults = games.map((g) => calcGame(g, settings));

  const totals = settings.names.map((_, pi) => ({
    score:  allResults.reduce((s, r) => s + (r ? r[pi].finalScore : 0), 0),
    amount: allResults.reduce((s, r) => s + (r ? r[pi].totalAmount : 0), 0),
    chips:  games.reduce((s, g) => s + toNum(g.chips[pi]), 0), // toNum で安全集計
  }));

  return (
    <div className="app-root">
      <nav className="tab-nav">
        {(
          [
            { key: "setup",   label: "前提条件" },
            { key: "score",   label: "点数計算" },
            { key: "history", label: "戦歴" },
          ] as { key: Tab; label: string }[]
        ).map((t) => (
          <button
            key={t.key}
            className={`tab-btn${tab === t.key ? " tab-btn--on" : ""}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <div className={`page-body${tab === "score" ? " page-body--score" : ""}`}>
        {tab === "setup" && (
          <SetupTab
            settings={settings}
            onChange={setSettings}
            onCountChange={changePlayerCount}
            onSave={saveSettings}
          />
        )}
        {tab === "score" && (
          <ScoreTab
            settings={settings}
            games={games}
            allResults={allResults}
            totals={totals}
            onUpdate={updateGame}
            onSaveGame={saveGame}
            onAdd={() => setGames((p) => [...p, makeGame(settings.playerCount)])}
          />
        )}
        {tab === "history" && <HistoryTab names={settings.names} />}
      </div>
    </div>
  );
}

// =====================
// SetupTab — 前提条件設定画面
// =====================
type SetupTabProps = {
  settings: Settings;
  onChange: (s: Settings) => void;
  onCountChange: (n: PlayerCount) => void;
  onSave: () => void;
};

function SetupTab({ settings: s, onChange, onCountChange, onSave }: SetupTabProps) {
  function upd<K extends keyof Settings>(k: K, v: Settings[K]) {
    onChange({ ...s, [k]: v });
  }

  function setName(i: number, v: string) {
    const names = [...s.names];
    names[i] = v;
    upd("names", names);
  }

  // ウマ入力：allowNegInt を通過した文字列のみ保存
  function setUma(i: number, v: string) {
    if (!allowNegInt(v)) return; // 数字・マイナス以外は弾く
    const uma = [...s.uma];
    uma[i] = v;
    upd("uma", uma);
  }

  // ウマの±ボタン
  function toggleUmaMinus(i: number) {
    const uma = [...s.uma];
    uma[i] = toggleMinus(uma[i]);
    upd("uma", uma);
  }

  function fmtUma(u: string): string {
    const n = parseFloat(u);
    if (isNaN(n)) return u || "0";
    return n >= 0 ? `+${n}` : String(n);
  }

  return (
    <div className="setup-tab">
      <h2 className="sec-title">前提条件の設定</h2>

      {/* プレイ人数 */}
      <div className="field-block">
        <div className="field-label">プレイ人数</div>
        <div className="seg-row">
          {([3, 4] as PlayerCount[]).map((n) => (
            <button
              key={n}
              className={`seg-btn${s.playerCount === n ? " seg-btn--on" : ""}`}
              onClick={() => onCountChange(n)}
            >
              {n}人麻雀
            </button>
          ))}
        </div>
      </div>

      {/* プレイヤー名 */}
      <div className="field-block">
        <div className="field-label">プレイヤー名</div>
        {s.names.map((name, i) => (
          <div key={i} className="row-field">
            <span className="row-key">P{i + 1}</span>
            <input
              className="txt-input"
              value={name}
              onChange={(e) => setName(i, e.target.value)}
              placeholder={`プレイヤー${i + 1}`}
              maxLength={10}
            />
          </div>
        ))}
      </div>

      {/* 点数・レート設定（これらは常に正の値なので type="number" のまま） */}
      <div className="field-block">
        <div className="field-label">点数・レート設定</div>
        {(
          [
            { label: "初期持ち点", key: "initialPoints", unit: "点" },
            { label: "清算基準点", key: "basePoints",    unit: "点" },
            { label: "点数レート", key: "pointRate",     unit: "円/点" },
            { label: "チップレート", key: "chipRate",    unit: "円/枚" },
          ] as { label: string; key: keyof Settings; unit: string }[]
        ).map(({ label, key, unit }) => (
          <div key={key} className="row-field">
            <span className="row-key">{label}</span>
            <div className="num-wrap">
              <input
                type="number"
                inputMode="numeric"
                className="num-input"
                value={s[key] as number}
                onChange={(e) => upd(key, Number(e.target.value) as Settings[typeof key])}
              />
              <span className="unit">{unit}</span>
            </div>
          </div>
        ))}
      </div>

      {/* ウマ設定（マイナス入力対応） */}
      <div className="field-block">
        <div className="field-label">ウマ設定</div>
        <p className="field-note">
          {s.playerCount}人麻雀のデフォルト：
          {s.uma.map((u, i) => `${i + 1}位 ${fmtUma(u)}`).join("、")}
        </p>
        {s.uma.map((u, i) => (
          <div key={i} className="row-field">
            <span className="row-key">{i + 1}位</span>
            <div className="num-wrap">
              {/*
                iOS マイナス対応：
                ・type="text"       → フルキーボード（マイナスキーあり）
                ・inputMode="numeric" → iOSでテンキー優先表示
                ・allowNegInt で数字・マイナス以外の入力を弾く
                ・± ボタンで符号をワンタップ切替（テンキーにマイナスがない端末でも使える）
              */}
              <input
                type="text"
                inputMode="numeric"
                className="num-input"
                value={u}
                onChange={(e) => setUma(i, e.target.value)}
                placeholder="例: -10"
              />
              <button
                type="button"
                className="pm-btn"
                onClick={() => toggleUmaMinus(i)}
                aria-label={`${i + 1}位ウマの符号を切り替え`}
              >
                ±
              </button>
              <span className="unit">pt</span>
            </div>
          </div>
        ))}
      </div>

      <button className="btn-primary" onClick={onSave}>
        設定を保存して点数入力へ進む →
      </button>
    </div>
  );
}

// =====================
// ScoreTab — 点数計算画面
// =====================
type ScoreTabProps = {
  settings: Settings;
  games: GameEntry[];
  allResults: (GameResult[] | null)[];
  totals: { score: number; amount: number; chips: number }[];
  onUpdate: (
    gIdx: number,
    field: "finalPoints" | "chips",
    pIdx: number,
    val: string
  ) => void;
  onAdd: () => void;
  onSaveGame: (gIdx: number) => void;
};

function ScoreTab({
  settings,
  games,
  allResults,
  totals,
  onUpdate,
  onAdd,
  onSaveGame,
}: ScoreTabProps) 
{
  const expected = settings.initialPoints * settings.playerCount;

  return (
    <div className="score-tab">
      <h2 className="sec-title">点数計算</h2>

      {games.map((g, gi) => (
        <GameCard
          key={gi}
          gi={gi}
          game={g}
          result={allResults[gi]}
          settings={settings}
          expected={expected}
          onUpdate={(field, pi, val) => onUpdate(gi, field, pi, val)}
          onSave={() => onSaveGame(gi)}
        />
      ))}

      <button className="btn-add" onClick={onAdd}>
        ＋ ゲームを追加
      </button>

      {/* 画面下部固定の合計成績バー */}
      <div className="score-footer">
        <div className="footer-title">▼ 合計成績</div>
        <div
          className="footer-grid"
          style={{ gridTemplateColumns: `repeat(${settings.playerCount}, 1fr)` }}
        >
          {settings.names.map((name, pi) => (
            <div key={pi} className="footer-cell">
              <div className="footer-name">{name}</div>
              <div className={`footer-score ${totals[pi].score >= 0 ? "pos" : "neg"}`}>
                {fmtScore(totals[pi].score, "pt")}
              </div>
              <div className="footer-chips">
                {totals[pi].chips >= 0 ? "+" : ""}{totals[pi].chips}枚
              </div>
              <div className={`footer-amt ${totals[pi].amount >= 0 ? "pos" : "neg"}`}>
                {fmtAmt(totals[pi].amount)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// =====================
// GameCard — 1ゲーム分の入力＆結果
// =====================
type GameCardProps = {
  gi: number;
  game: GameEntry;
  result: GameResult[] | null;
  settings: Settings;
  expected: number;
  onUpdate: (field: "finalPoints" | "chips", pi: number, val: string) => void;
  onSave: () => void;
};

function GameCard({
  gi,
  game,
  result,
  settings,
  expected,
  onUpdate,
  onSave,
}: GameCardProps) {
  const { names } = settings;
  const [resultOpen, setResultOpen] = useState(false);

  // "-" も未確定として計算対象から除外
  const allEntered = game.finalPoints.every((v) => v !== "" && v !== "-");
  const fpSum = game.finalPoints.reduce((s, v) => s + toNum(v), 0);
  const sumOk = allEntered && fpSum === expected;

  // 最終持ち点：allowNegInt でバリデーション後に保存
  function updateFp(pi: number, v: string) {
    if (allowNegInt(v)) onUpdate("finalPoints", pi, v);
  }

  // チップ枚数：allowNegInt でバリデーション後に保存
  function updateChip(pi: number, v: string) {
    if (allowNegInt(v)) onUpdate("chips", pi, v);
  }

  // 最終持ち点の±ボタン
  function toggleFpMinus(pi: number) {
    onUpdate("finalPoints", pi, toggleMinus(game.finalPoints[pi]));
  }

  // チップ枚数の±ボタン
  function toggleChipMinus(pi: number) {
    onUpdate("chips", pi, toggleMinus(game.chips[pi]));
  }

  return (
    <div className="game-card">
      {/* ゲームヘッダー */}
      <div className="game-header">
        <span className="game-title">第 {gi + 1} ゲーム</span>
        {allEntered && (
          <span className={sumOk ? "badge-ok" : "badge-ng"}>
            {sumOk ? "✓ 合計OK" : `✗ 合計不一致（${fpSum.toLocaleString()}点）`}
          </span>
        )}
      </div>

      {/* 横並びグリッド入力 */}
      <div className="game-grid">
        <div
          className="game-grid-inner"
          style={{ gridTemplateColumns: `repeat(${names.length}, 1fr)` }}
        >
          {names.map((name, pi) => (
            <div key={pi} className="game-col">
              {/* プレイヤー名 */}
              <div className="p-col-name">{name}</div>

              {/* 最終持ち点（マイナス対応） */}
              <label className="p-col-lbl">最終持ち点</label>
              {/*
                iOS マイナス対応：
                ・type="text" inputMode="numeric" でテンキーを表示
                ・allowNegInt で数字・マイナス以外を弾く
                ・± ボタンで符号をワンタップ切替
              */}
              <input
                type="text"
                inputMode="numeric"
                className="score-inp"
                value={game.finalPoints[pi]}
                onChange={(e) => updateFp(pi, e.target.value)}
                placeholder="32000"
              />
              <button
                type="button"
                className="pm-btn-sm"
                onClick={() => toggleFpMinus(pi)}
                aria-label="最終持ち点の符号を切り替え"
              >
                ±
              </button>

              {/* チップ枚数（マイナス対応） */}
              <label className="p-col-lbl">チップ(枚)</label>
              <input
                type="text"
                inputMode="numeric"
                className="score-inp chip-inp"
                value={game.chips[pi]}
                onChange={(e) => updateChip(pi, e.target.value)}
                placeholder="0"
              />
              <button
                type="button"
                className="pm-btn-sm chip-pm"
                onClick={() => toggleChipMinus(pi)}
                aria-label="チップ枚数の符号を切り替え"
              >
                ±
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* 計算結果（全員入力済みのとき開閉ボタンを表示） */}
      {result && (
        <div className="result-wrap">
          <button
            className="result-toggle"
            onClick={() => setResultOpen((o) => !o)}
          >
            {resultOpen ? "計算結果を閉じる ▲" : "計算結果を表示 ▼"}
          </button>

          {resultOpen && (
            <div className="result-scroll">
              <table className="result-tbl">
                <thead>
                  <tr>
                    <th className="th-name">名前</th>
                    <th>順位</th>
                    <th>素点</th>
                    <th>ウマ</th>
                    <th>最終</th>
                    <th>点金額</th>
                    <th>チップ</th>
                    <th>合計</th>
                  </tr>
                </thead>
                <tbody>
                  {names.map((name, pi) => {
                    const r = result[pi];
                    return (
                      <tr key={pi}>
                        <td className="td-name">{name}</td>
                        <td className={RANK_CLS[r.rank - 1]}>{RANK_LABELS[r.rank - 1]}</td>
                        <td className={r.rawScore >= 0 ? "pos" : "neg"}>{fmtScore(r.rawScore)}</td>
                        <td className={r.umaVal >= 0 ? "pos" : "neg"}>{fmtScore(r.umaVal)}</td>
                        <td className={`bold ${r.finalScore >= 0 ? "pos" : "neg"}`}>{fmtScore(r.finalScore)}</td>
                        <td className={r.pointAmount >= 0 ? "pos" : "neg"}>{fmtAmt(r.pointAmount)}</td>
                        <td className={r.chipAmount >= 0 ? "pos" : "neg"}>{fmtAmt(r.chipAmount)}</td>
                        <td className={`bold ${r.totalAmount >= 0 ? "pos" : "neg"}`}>{fmtAmt(r.totalAmount)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
      {result && sumOk && (
  <button
    className="btn-primary"
    onClick={onSave}
  >
    このゲームを保存
  </button>
)}
    </div>
  );
}

// =====================
// HistoryTab — 戦歴画面
// =====================
function HistoryTab({ names }: { names: string[] }) {
  return (
    <div className="history-tab">
      <h2 className="sec-title">戦歴</h2>
      <div className="history-notice">
        ※ この機能は今後DB連携予定です。現在はデータが保存されていません。
      </div>
      {names.map((name, i) => (
        <div key={i} className="history-card">
          <div className="h-player">{name}</div>
          <div className="h-stats-placeholder">
            <span className="h-stat-item">対局数: ——</span>
            <span className="h-stat-item">平均順位: ——</span>
            <span className="h-stat-item">合計スコア: ——</span>
          </div>
          <div className="h-empty">対局データなし（DB連携後に表示されます）</div>
        </div>
      ))}
    </div>
  );
}
