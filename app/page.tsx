"use client";

import { useState } from "react";

type Round = { scores: number[] };

const PLAYER_COUNT = 4;
const DEFAULT_NAMES = ["", "", "", ""];
const DEFAULT_INPUTS = ["", "", "", ""];

export default function Home() {
  const [phase, setPhase] = useState<"setup" | "game">("setup");
  const [names, setNames] = useState<string[]>(DEFAULT_NAMES);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [inputs, setInputs] = useState<string[]>(DEFAULT_INPUTS);
  const [error, setError] = useState("");

  const totals = Array.from({ length: PLAYER_COUNT }, (_, i) =>
    rounds.reduce((sum, r) => sum + r.scores[i], 0)
  );

  const rankOrder = [...totals]
    .map((t, i) => ({ t, i }))
    .sort((a, b) => b.t - a.t)
    .map((x) => x.i);

  function handleStart() {
    if (names.some((n) => !n.trim())) {
      setError("全員の名前を入力してください");
      return;
    }
    setError("");
    setPhase("game");
  }

  function handleAddRound() {
    if (inputs.some((v) => v === "")) {
      setError("全員のスコアを入力してください");
      return;
    }
    const scores = inputs.map(Number);
    setRounds((prev) => [...prev, { scores }]);
    setInputs([...DEFAULT_INPUTS]);
    setError("");
  }

  function handleReset() {
    setPhase("setup");
    setNames([...DEFAULT_NAMES]);
    setRounds([]);
    setInputs([...DEFAULT_INPUTS]);
    setError("");
  }

  function updateName(i: number, val: string) {
    setNames((prev) => prev.map((n, idx) => (idx === i ? val : n)));
  }

  function updateInput(i: number, val: string) {
    setInputs((prev) => prev.map((v, idx) => (idx === i ? val : v)));
    setError("");
  }

  const rankLabels = ["1位", "2位", "3位", "4位"];
  const rankColors = [
    "text-yellow-300",
    "text-slate-300",
    "text-amber-600",
    "text-slate-500",
  ];

  if (phase === "setup") {
    return (
      <div className="setup-screen">
        <div className="setup-inner">
          <h1 className="app-title">🀄 麻雀スコア</h1>
          <p className="app-subtitle">プレイヤー名を入力してください</p>

          <div className="name-inputs">
            {names.map((name, i) => (
              <div key={i} className="name-row">
                <span className="player-label">P{i + 1}</span>
                <input
                  className="name-input"
                  value={name}
                  onChange={(e) => updateName(i, e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleStart()}
                  placeholder={`プレイヤー${i + 1}の名前`}
                  maxLength={10}
                />
              </div>
            ))}
          </div>

          {error && <p className="error-msg">{error}</p>}

          <button className="btn-primary" onClick={handleStart}>
            ゲーム開始
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="game-screen">
      <h1 className="app-title">🀄 麻雀スコア</h1>

      {/* スコアボード */}
      <section className="scoreboard">
        {rankOrder.map((playerIdx, rank) => (
          <div
            key={playerIdx}
            className={`score-card ${rank === 0 ? "score-card--top" : ""}`}
          >
            <span className={`rank-label ${rankColors[rank]}`}>
              {rankLabels[rank]}
            </span>
            <span className="player-name">{names[playerIdx]}</span>
            <span
              className={`total-score ${
                totals[playerIdx] > 0
                  ? "score-pos"
                  : totals[playerIdx] < 0
                    ? "score-neg"
                    : "score-zero"
              }`}
            >
              {totals[playerIdx] > 0 ? "+" : ""}
              {totals[playerIdx]}
            </span>
          </div>
        ))}
      </section>

      {/* スコア入力 */}
      <section className="input-section">
        <h2 className="section-title">第 {rounds.length + 1} 局</h2>
        <div className="score-inputs">
          {names.map((name, i) => (
            <div key={i} className="score-input-row">
              <label className="score-input-label">{name}</label>
              <input
                type="number"
                inputMode="numeric"
                className="score-input"
                value={inputs[i]}
                onChange={(e) => updateInput(i, e.target.value)}
                placeholder="0"
              />
            </div>
          ))}
        </div>
        {error && <p className="error-msg">{error}</p>}
        <button
          className="btn-primary"
          onClick={handleAddRound}
          disabled={inputs.some((v) => v === "")}
        >
          記録する
        </button>
      </section>

      {/* 履歴 */}
      {rounds.length > 0 && (
        <section className="history-section">
          <h2 className="section-title">履歴</h2>
          <div className="history-table-wrap">
            <table className="history-table">
              <thead>
                <tr>
                  <th className="th-round">局</th>
                  {names.map((name, i) => (
                    <th key={i} className="th-player">
                      {name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rounds.map((round, ri) => (
                  <tr key={ri} className="history-row">
                    <td className="td-round">{ri + 1}</td>
                    {round.scores.map((score, si) => (
                      <td
                        key={si}
                        className={`td-score ${
                          score > 0
                            ? "score-pos"
                            : score < 0
                              ? "score-neg"
                              : "score-zero"
                        }`}
                      >
                        {score > 0 ? "+" : ""}
                        {score}
                      </td>
                    ))}
                  </tr>
                ))}
                <tr className="total-row">
                  <td className="td-round">計</td>
                  {totals.map((t, i) => (
                    <td
                      key={i}
                      className={`td-score font-bold ${
                        t > 0 ? "score-pos" : t < 0 ? "score-neg" : "score-zero"
                      }`}
                    >
                      {t > 0 ? "+" : ""}
                      {t}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      )}

      <button className="btn-reset" onClick={handleReset}>
        リセット
      </button>
    </div>
  );
}
