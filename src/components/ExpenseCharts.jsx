import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from "chart.js";
import { Bar, Line } from "react-chartjs-2";
import {
  formatCompactMoney,
  formatMoney,
  formatPercent,
} from "../utils/format.js";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Filler,
  Tooltip,
  Legend,
);

const GRID_COLOR = "rgba(255, 255, 255, 0.06)";
const TICK_COLOR = "#71717a";
const LEGEND_COLOR = "#a1a1aa";

const stackedScale = {
  stacked: true,
  grid: { color: GRID_COLOR, drawBorder: false },
  border: { display: false },
  ticks: {
    color: TICK_COLOR,
    font: { size: 10 },
    maxRotation: 0,
    autoSkip: true,
    maxTicksLimit: 10,
  },
};

function EmptyChart({ message }) {
  return (
    <div className="flex h-36 items-center justify-center rounded-xl border border-dashed border-white/[0.07] text-xs text-zinc-600">
      {message}
    </div>
  );
}

export function CategoryBreakdownChart({ byCategory, total }) {
  if (byCategory.length === 0 || total <= 0) {
    return <EmptyChart message="No expenses in this range yet." />;
  }

  const data = {
    labels: ["Spend"],
    datasets: byCategory.map((category) => ({
      label: category.name,
      data: [category.total],
      backgroundColor: category.color,
      borderColor: "rgba(13, 15, 18, 0.8)",
      borderWidth: 1,
      borderSkipped: false,
      borderRadius: 4,
      barThickness: 32,
    })),
  };

  const options = {
    indexAxis: "y",
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 250 },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: "rgba(9, 11, 13, 0.95)",
        borderColor: "rgba(255, 255, 255, 0.1)",
        borderWidth: 1,
        padding: 10,
        callbacks: {
          label: (context) =>
            `${context.dataset.label}: ${formatMoney(context.parsed.x)}`,
        },
      },
    },
    scales: {
      x: {
        stacked: true,
        // Pin the axis to exactly 0 → total so the stacked bar always fills
        // the full width (100%) instead of leaving Chart.js "nice number"
        // headroom past the total.
        min: 0,
        max: total,
        grace: 0,
        grid: { color: GRID_COLOR, drawBorder: false },
        border: { display: false },
        ticks: {
          color: TICK_COLOR,
          font: { size: 10 },
          callback: (value) => formatCompactMoney(value),
        },
      },
      y: { stacked: true, display: false },
    },
  };

  return (
    <div>
      <div className="h-20">
        <Bar data={data} options={options} />
      </div>

      <div className="mt-4 max-h-56 space-y-2 overflow-y-auto pr-1">
        {byCategory.map((category) => (
          <div
            key={category.key}
            className="flex items-center gap-2.5 text-xs"
          >
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: category.color }}
            />

            <span className="min-w-0 flex-1 truncate text-zinc-400">
              {category.name}
            </span>

            <span className="shrink-0 tabular-nums text-zinc-600">
              {formatPercent(category.share, 0)}
            </span>

            <span className="w-24 shrink-0 text-right font-medium tabular-nums text-zinc-200">
              {formatMoney(category.total)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function CategoryTimeChart({ series }) {
  if (series.categories.length === 0 || series.labels.length === 0) {
    return <EmptyChart message="Nothing to plot for this range." />;
  }

  const data = {
    labels: series.labels,
    datasets: series.categories.map((category, index) => ({
      label: category.name,
      data: series.values[index],
      fill: true,
      backgroundColor: category.color,
      borderColor: category.color,
      borderWidth: 1.5,
      tension: 0.25,
      pointRadius: 0,
      pointHitRadius: 8,
    })),
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 250 },
    interaction: { mode: "index", intersect: false },
    plugins: {
      legend: {
        position: "bottom",
        labels: {
          color: LEGEND_COLOR,
          boxWidth: 8,
          boxHeight: 8,
          usePointStyle: true,
          pointStyle: "circle",
          padding: 12,
          font: { size: 10 },
        },
      },
      tooltip: {
        backgroundColor: "rgba(9, 11, 13, 0.95)",
        borderColor: "rgba(255, 255, 255, 0.1)",
        borderWidth: 1,
        padding: 10,
        filter: (item) => Number(item.parsed.y) > 0,
        callbacks: {
          label: (context) =>
            `${context.dataset.label}: ${formatMoney(context.parsed.y)}`,
        },
      },
    },
    scales: {
      x: stackedScale,
      y: {
        ...stackedScale,
        ticks: {
          ...stackedScale.ticks,
          callback: (value) => formatCompactMoney(value),
        },
      },
    },
  };

  return (
    <div className="h-72">
      <Line data={data} options={options} />
    </div>
  );
}
