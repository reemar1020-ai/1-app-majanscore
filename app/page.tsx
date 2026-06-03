"use client";

import { useState } from "react";

// ===== 型定義 =====
type PlayerCount = 3 | 4;
type Tab = "setup" | "score" | "history";

/** アプリ全体の前提条件 */
type Settings = {
  playerCount: PlayerCount;
  names: string[];
  initialPoints: number; // 初期持ち点（配布点数）
  basePoints: number;    // 清算基準点（精算時の基準）
  pointRate: number;     // 点数レート（円/点）
  chipRate: number;      // チップレート（円/枚）
  uma: number[];         // ウマ配列（1位から順に）
};

/** 1ゲーム分の入力データ */
type GameEntry = {
  finalPoints: string[]; // 最終持ち点（文字列で管理して空欄を許可）
  chips: string[];       // チップ枚数（プラス・マイナス可）
};

/** 1ゲーム分の計算結果 */
type GameResult = {
  rank: number;        // 順位（1始まり）
  rawScore: number;    // 素点スコア
  umaVal: number;      // ウマ
  finalScore: number;  // 最終スコア
  pointAmount: number; // 点数金額（円）
  chipAmount: number;  // チップ金額（円）
  totalAmount: number; // 合計金額（円）
};

// ===== 定数 =====
const UMA_DEFAULTS: Record<PlayerCount, number[]> = {
  4: [20, 10, -10, -20],
  3: [15, 0, -15],
};
const RANK_LABELS = ["1位", "2位", "3位", "4位"];
const RANK_CLS = ["rank1", "rank2", "rank3", "rank4"];

// ===== ファクトリ関数 =====
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
/**
 * 1ゲームの計算を行う。
 * 全員の最終持ち点が未入力の場合は null を返す。
 */
function calcGame(game: GameEntry, s: Settings): GameResult[] | null {
  // 1人でも最終持ち点が未入力なら計算しない
  if (game.finalPoints.some((v) => v === "")) return null;

  const fp = game.finalPoints.map(Number);
  const ch = game.chips.map((v) => (v === "" ? 0 : Number(v)));

  // 順位決定: 持ち点の高い順、同点は入力順（インデックス小さい方が上）
  const rankOf: number[] = new Array(s.playerCount);
  fp.map((p, i) => ({ p, i }))
    .sort((a, b) => b.p - a.p || a.i - b.i)
    .forEach(({ i }, ri) => { rankOf[i] = ri + 1; });

  return fp.map((p, i) => {
    // 素点スコア = (最終持ち点 - 清算基準点) / 1000
    const raw = (p - s.basePoints) / 1000;
    // ウマ = 順位に応じた加点
    const umaVal = s.uma[rankOf[i] - 1];
    // 最終スコア = 素点スコア + ウマ
    const final = raw + umaVal;
    // 点数金額 = 最終スコア × 点数レート
    const pointAmt = Math.round(final * s.pointRate);
    // チップ金額 = チップ枚数 × チップレート
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

// ===== フォーマット関数 =====
/** スコアを符号付き文字列に変換（整数は小数点なし）*/
function fmtScore(n: number, unit = "") {
  const abs = Math.abs(n);
  const str = Number.isInteger(abs) ? String(abs) : abs.toFixed(1);
  return (n > 0 ? "+" : n < 0 ? "-" : "") + str + unit;
}

/** 金額を符号付き円表示に変換 */
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

  // 人数変更時は設定・ゲームデータをリセット
  function changePlayerCount(n: PlayerCount) {
    setSettings(makeSettings(n));
    setGames(Array(5).fill(null).map(() => makeGame(n)));
  }

  // 設定保存してスコア入力画面へ
  function saveSettings() {
    if (settings.names.some((nm) => !nm.trim())) {
      alert("プレイヤー名を全員入力してください");
      return;
    }
    setTab("score");
  }

  // ゲームデータの1マス更新
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

  // 全ゲームの計算結果
  const allResults = games.map((g) => calcGame(g, settings));

  // プレイヤーごとの合計（全ゲーム合算）
  const totals = settings.names.map((_, pi) => ({
    score: allResults.reduce((s, r) => s + (r ? r[pi].finalScore : 0), 0),
    amount: allResults.reduce((s, r) => s + (r ? r[pi].totalAmount : 0), 0),
  }));

  return (
    <div className="app-root">
      {/* タブナビゲーション */}
      <nav className="tab-nav">
        {(
          [
            { key: "setup", label: "前提条件" },
            { key: "score", label: "点数計算" },
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

      <div className="page-body">
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
            onAdd={() =>
              setGames((p) => [...p, makeGame(settings.playerCount)])
            }
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
  // 設定の1フィールドを更新するヘルパー
  function upd<K extends keyof Settings>(k: K, v: Settings[K]) {
    onChange({ ...s, [k]: v });
  }

  function setName(i: number, v: string) {
    const names = [...s.names];
    names[i] = v;
    upd("names", names);
  }

  function setUma(i: number, v: string) {
    const uma = [...s.uma];
    uma[i] = v === "" || v === "-" ? 0 : Number(v);
    upd("uma", uma);
  }

  return (
    <div className="setup-tab">
      <h2 className="sec-title">前提条件の設定</h2>

      {/* ── プレイ人数 ── */}
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

      {/* ── プレイヤー名 ── */}
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

      {/* ── 点数・レート設定 ── */}
      <div className="field-block">
        <div className="field-label">点数・レート設定</div>
        {(
          [
            { label: "初期持ち点", key: "initialPoints", unit: "点" },
            { label: "清算基準点", key: "basePoints", unit: "点" },
            { label: "点数レート", key: "pointRate", unit: "円/点" },
            { label: "チップレート", key: "chipRate", unit: "円/枚" },
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

      {/* ── ウマ設定 ── */}
      <div className="field-block">
        <div className="field-label">ウマ設定</div>
        <p className="field-note">
          {s.playerCount}人麻雀のデフォルト：
          {s.uma.map((u, i) => `${i + 1}位 ${u > 0 ? "+" : ""}${u}`).join("、")}
        </p>
        {s.uma.map((u, i) => (
          <div key={i} className="row-field">
            <span className="row-key">{i + 1}位</span>
            <div className="num-wrap">
              <input
                type="number"
                inputMode="numeric"
                className="num-input"
                value={u}
                onChange={(e) => setUma(i, e.target.value)}
              />
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
  totals: { score: number; amount: number }[];
  onUpdate: (
    gIdx: number,
    field: "finalPoints" | "chips",
    pIdx: number,
    val: string
  ) => void;
  onAdd: () => void;
};

function ScoreTab({ settings, games, allResults, totals, onUpdate, onAdd }: ScoreTabProps) {
  // 初期持ち点 × 人数 = ゲーム全体の持ち点合計
  const expected = settings.initialPoints * settings.playerCount;
  const hasAny = allResults.some((r) => r !== null);

  return (
    <div className="score-tab">
      <h2 className="sec-title">点数計算</h2>

      {/* 合計成績サマリー（1ゲーム以上入力済みの場合に表示） */}
      {hasAny && (
        <div className="summary-card">
          <div className="summary-title">合計成績</div>
          <div className="summary-grid">
            {settings.names.map((name, pi) => (
              <div key={pi} className="summary-cell">
                <div className="summary-name">{name}</div>
                <div className={`summary-score ${totals[pi].score >= 0 ? "pos" : "neg"}`}>
                  {fmtScore(totals[pi].score, "pt")}
                </div>
                <div className={`summary-amt ${totals[pi].amount >= 0 ? "pos" : "neg"}`}>
                  {fmtAmt(totals[pi].amount)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 各ゲームカード */}
      {games.map((g, gi) => (
        <GameCard
          key={gi}
          gi={gi}
          game={g}
          result={allResults[gi]}
          settings={settings}
          expected={expected}
          onUpdate={(field, pi, val) => onUpdate(gi, field, pi, val)}
        />
      ))}

      {/* ゲーム追加ボタン */}
      <button className="btn-add" onClick={onAdd}>
        ＋ ゲームを追加
      </button>
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
};

function GameCard({ gi, game, result, settings, expected, onUpdate }: GameCardProps) {
  const { names } = settings;

  // 持ち点合計チェック
  const allEntered = game.finalPoints.every((v) => v !== "");
  const fpSum = game.finalPoints.reduce((s, v) => s + (Number(v) || 0), 0);
  const sumOk = allEntered && fpSum === expected;

  return (
    <div className="game-card">
      {/* ゲームヘッダー */}
      <div className="game-header">
        <span className="game-title">第 {gi + 1} ゲーム</span>
        {allEntered && (
          <span className={sumOk ? "badge-ok" : "badge-ng"}>
            {sumOk
              ? "✓ 合計OK"
              : `✗ 合計不一致（${fpSum.toLocaleString()}点）`}
          </span>
        )}
      </div>

      {/* 入力フォーム */}
      <div className="game-inputs">
        {names.map((name, pi) => (
          <div key={pi} className="p-row">
            <span className="p-name">{name}</span>
            <div className="p-fields">
              <div className="p-field">
                <label className="p-field-lbl">最終持ち点</label>
                <input
                  type="number"
                  inputMode="numeric"
                  className="score-inp"
                  value={game.finalPoints[pi]}
                  onChange={(e) => onUpdate("finalPoints", pi, e.target.value)}
                  placeholder="例: 32000"
                />
              </div>
              <div className="p-field">
                <label className="p-field-lbl">チップ（枚）</label>
                <input
                  type="number"
                  inputMode="numeric"
                  className="score-inp chip-inp"
                  value={game.chips[pi]}
                  onChange={(e) => onUpdate("chips", pi, e.target.value)}
                  placeholder="0"
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 計算結果テーブル（全員入力済みの場合のみ表示） */}
      {result && (
        <div className="result-wrap">
          <div className="result-label">計算結果</div>
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
                      <td className={RANK_CLS[r.rank - 1]}>
                        {RANK_LABELS[r.rank - 1]}
                      </td>
                      <td className={r.rawScore >= 0 ? "pos" : "neg"}>
                        {fmtScore(r.rawScore)}
                      </td>
                      <td className={r.umaVal >= 0 ? "pos" : "neg"}>
                        {fmtScore(r.umaVal)}
                      </td>
                      <td className={`bold ${r.finalScore >= 0 ? "pos" : "neg"}`}>
                        {fmtScore(r.finalScore)}
                      </td>
                      <td className={r.pointAmount >= 0 ? "pos" : "neg"}>
                        {fmtAmt(r.pointAmount)}
                      </td>
                      <td className={r.chipAmount >= 0 ? "pos" : "neg"}>
                        {fmtAmt(r.chipAmount)}
                      </td>
                      <td className={`bold ${r.totalAmount >= 0 ? "pos" : "neg"}`}>
                        {fmtAmt(r.totalAmount)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
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
          <div className="h-empty">
            対局データなし（DB連携後に表示されます）
          </div>
        </div>
      ))}
    </div>
  );
}
