"use client";

import { useEffect, useMemo, useState } from "react";

import {
  OUTCOME_COLORS,
  OUTCOME_LABELS,
  OUTCOME_ORDER,
  formatPercentage,
  priceFromProbability,
} from "../../lib/marketUtils";
import { MarketSnapshot, OutcomeId } from "../../lib/types";

interface ProbabilityChartProps {
  history: MarketSnapshot[];
  mode: "probability" | "price";
}

export function ProbabilityChart({ history, mode }: ProbabilityChartProps) {
  const width = 640;
  const height = 240;
  const count = Math.max(history.length, 1);
  const gridSize = 40;
  const [hoverIdx, setHoverIdx] = useState(count - 1);

  // Reset hoverIdx keď sa zmení počet bodov v histórii
  useEffect(() => {
    setHoverIdx(count - 1);
  }, [count]);

  const applyEma = (values: number[], alpha = 0.35) => {
    if (!values.length) return values;
    const smoothed: number[] = [];
    let prev = values[0];
    values.forEach((v) => {
      prev = prev * (1 - alpha) + v * alpha;
      smoothed.push(prev);
    });
    return smoothed;
  };

  const allSeries = useMemo(() => {
    const series = OUTCOME_ORDER.reduce((acc, id) => {
      const rawProb = history.map((snap) => snap.probabilities[id]);
      const raw =
        mode === "probability"
          ? rawProb
          : rawProb.map((p) => priceFromProbability(p));
      acc[id] = { raw, smooth: applyEma(raw) };
      return acc;
    }, {} as Record<OutcomeId, { raw: number[]; smooth: number[] }>);

    // Dynamický rozsah pre lepšiu vizualizáciu
    const allValues = OUTCOME_ORDER.flatMap((id) => series[id].smooth);
    const dataMin = Math.min(...allValues);
    const dataMax = Math.max(...allValues);
    
    // Pridaj padding 10% hore a dole
    const range = dataMax - dataMin;
    const padding = Math.max(range * 0.15, 0.02); // min 2% padding
    
    let minVal = Math.max(0, dataMin - padding);
    let maxVal = mode === "probability" 
      ? Math.min(1, dataMax + padding)
      : dataMax + padding;
    
    // Zaokrúhli na pekné čísla (5% kroky pre probability)
    if (mode === "probability") {
      minVal = Math.floor(minVal * 20) / 20; // zaokrúhli na 5%
      maxVal = Math.ceil(maxVal * 20) / 20;
      // Zabezpeč minimálny rozsah 15%
      if (maxVal - minVal < 0.15) {
        const center = (maxVal + minVal) / 2;
        minVal = Math.max(0, center - 0.075);
        maxVal = Math.min(1, center + 0.075);
      }
    }
    
    return { series, minVal, maxVal };
  }, [history, mode]);

  const buildPath = (values: number[], minVal: number, maxVal: number) => {
    const range = maxVal - minVal;
    return values
      .map((v, idx) => {
        const x =
          count === 1 ? 0 : (idx / Math.max(count - 1, 1)) * width;
        const y = height - ((v - minVal) / range) * height;
        return `${idx === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(" ");
  };

  if (!history.length) {
    return (
      <div className="flex h-56 w-full items-center justify-center rounded-lg border border-dashed border-slate-200 bg-white text-sm text-slate-600">
        Ziadne data pre graf.
      </div>
    );
  }

  const hoverValues = OUTCOME_ORDER.map((id) => {
    const { smooth } = allSeries.series[id];
    const v = smooth[Math.min(hoverIdx, smooth.length - 1)];
    return {
      id,
      label: OUTCOME_LABELS[id],
      value: mode === "probability" ? `${(v * 100).toFixed(1)}%` : v.toFixed(3),
    };
  });

  return (
    <div className="relative flex flex-col gap-2">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-56 w-full rounded-lg border border-slate-200 bg-white"
      >
        <defs>
          <pattern
            id="grid"
            width={gridSize}
            height={gridSize}
            patternUnits="userSpaceOnUse"
          >
            <path
              d={`M ${gridSize} 0 L 0 0 0 ${gridSize}`}
              fill="none"
              stroke="#e2e8f0"
              strokeWidth="1"
            />
          </pattern>
        </defs>
        <rect width={width} height={height} fill="url(#grid)" />
        <line
          x1={0}
          y1={height}
          x2={width}
          y2={height}
          stroke="#cbd5e1"
          strokeWidth={1}
        />
        <line
          x1={0}
          y1={0}
          x2={0}
          y2={height}
          stroke="#cbd5e1"
          strokeWidth={1}
        />
        {Array.from({ length: 5 }).map((_, i) => {
          const { minVal, maxVal } = allSeries;
          const range = maxVal - minVal;
          const val = minVal + (i / 4) * range;
          const y = height - (i / 4) * height;
          return (
            <g key={i}>
              <line
                x1={0}
                y1={y}
                x2={6}
                y2={y}
                stroke="#cbd5e1"
                strokeWidth={1}
              />
              <text
                x={10}
                y={y + 5}
                fontSize={13}
                fill="#1f2937"
              >
                {mode === "probability"
                  ? `${Math.round(val * 100)}%`
                  : val.toFixed(2)}
              </text>
            </g>
          );
        })}
        {OUTCOME_ORDER.map((id) => {
          const { raw, smooth } = allSeries.series[id];
          const { minVal, maxVal } = allSeries;
          const range = maxVal - minVal;
          const lastIdx = smooth.length - 1;
          const lastX =
            smooth.length === 1
              ? 0
              : (lastIdx / Math.max(count - 1, 1)) * width;
          const lastY = height - ((smooth[lastIdx] - minVal) / range) * height;
          const hoverValue = smooth[Math.min(hoverIdx, smooth.length - 1)];
          const hoverX =
            smooth.length === 1
              ? 0
              : (Math.min(hoverIdx, smooth.length - 1) /
                  Math.max(count - 1, 1)) *
                width;
          const hoverY = height - ((hoverValue - minVal) / range) * height;

          return (
            <g key={id}>
              <path
                d={buildPath(raw, minVal, maxVal)}
                fill="none"
                stroke={OUTCOME_COLORS[id]}
                strokeOpacity={0.25}
                strokeWidth={2}
                strokeLinecap="round"
              />
              <path
                d={buildPath(smooth, minVal, maxVal)}
                fill="none"
                stroke={OUTCOME_COLORS[id]}
                strokeWidth={3}
                strokeLinecap="round"
              />
              <circle
                cx={hoverX}
                cy={hoverY}
                r={4.5}
                fill="white"
                stroke={OUTCOME_COLORS[id]}
                strokeWidth={2}
              />
              <circle
                cx={lastX}
                cy={lastY}
                r={4}
                fill={OUTCOME_COLORS[id]}
                stroke="white"
                strokeWidth={1.5}
              />
            </g>
          );
        })}
        <rect
          x={0}
          y={0}
          width={width}
          height={height}
          fill="transparent"
          onMouseMove={(e) => {
            const bounds = (e.currentTarget as SVGRectElement).getBoundingClientRect();
            const x = e.clientX - bounds.left;
            const ratio = Math.max(0, Math.min(1, x / bounds.width));
            const idx = Math.round(ratio * (count - 1));
            setHoverIdx(idx);
          }}
          onMouseLeave={() => setHoverIdx(count - 1)}
        />
        <line
          x1={
            count === 1
              ? 0
              : (Math.min(hoverIdx, count - 1) / Math.max(count - 1, 1)) * width
          }
          y1={0}
          x2={
            count === 1
              ? 0
              : (Math.min(hoverIdx, count - 1) / Math.max(count - 1, 1)) * width
          }
          y2={height}
          stroke="#94a3b8"
          strokeDasharray="4 4"
          strokeWidth={1}
        />
      </svg>
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm">
        <div className="text-xs text-slate-500">
          Bod {Math.min(hoverIdx, count - 1) + 1} / {count} ·{" "}
          {mode === "probability" ? "Pravdepodobnosti" : "Ceny"}
        </div>
        <div className="flex flex-wrap gap-3">
          {hoverValues.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-2 rounded-full bg-slate-50 px-3 py-1"
            >
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: OUTCOME_COLORS[item.id] }}
              />
              <span className="text-xs font-semibold text-slate-800">
                {item.label}
              </span>
              <span className="text-xs font-mono text-slate-600">
                {item.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

interface ChartLegendProps {
  probabilities: Record<OutcomeId, number> | null;
}

export function ChartLegend({ probabilities }: ChartLegendProps) {
  return (
    <div className="mt-3 flex gap-3 text-xs text-slate-500">
      {OUTCOME_ORDER.map((id) => (
        <div key={id} className="flex items-center gap-2">
          <span
            className="h-3 w-3 rounded-full"
            style={{ backgroundColor: OUTCOME_COLORS[id] }}
          />
          <span className="font-medium text-slate-700">
            {OUTCOME_LABELS[id]}
          </span>
          <span>
            {probabilities
              ? formatPercentage(probabilities[id])
              : "--"}
          </span>
        </div>
      ))}
    </div>
  );
}
