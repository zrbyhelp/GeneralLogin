<template>
  <section class="panel-card panel-card--strong growth-card">
    <div class="growth-card__header">
      <div>
        <h2 class="growth-card__title">{{ t("admin.userGrowth") }}</h2>
        <p class="growth-card__meta">
          {{ t("admin.userGrowthSummary", { days: activeDays, count: addedUsers }) }}
        </p>
      </div>

      <div class="range-switch" role="group" :aria-label="t('admin.userGrowthRangeLabel')">
        <button
          v-for="days in dayRanges"
          :key="days"
          class="range-switch__button"
          :class="{ 'range-switch__button--active': activeDays === days }"
          type="button"
          :aria-pressed="activeDays === days"
          :disabled="loading && activeDays === days"
          @click="selectRange(days)"
        >
          {{ t("admin.rangeDays", { days }) }}
        </button>
      </div>
    </div>

    <div class="growth-chart-shell" :aria-busy="loading">
      <div ref="chartElement" class="growth-chart" :class="{ 'growth-chart--muted': loading || errorMessage || !hasData }" />

      <div v-if="loading" class="growth-chart-state growth-chart-state--loading" aria-live="polite">
        <span class="growth-chart-state__pulse" />
        <span>{{ t("common.loading") }}</span>
      </div>

      <div v-else-if="errorMessage" class="growth-chart-state" role="alert">
        <p>{{ errorMessage }}</p>
        <button class="ghost-btn growth-chart-state__button" type="button" @click="loadGrowth">
          {{ t("common.retry") }}
        </button>
      </div>

      <div v-else-if="!hasData" class="growth-chart-state">
        <p>{{ t("admin.userGrowthEmpty") }}</p>
      </div>

      <p class="growth-chart-summary">
        {{ accessibleSummary }}
      </p>
    </div>
  </section>
</template>

<script setup lang="ts">
import { BarChart, LineChart } from "echarts/charts";
import {
  AriaComponent,
  GridComponent,
  LegendComponent,
  TooltipComponent
} from "echarts/components";
import { init, use, type EChartsType } from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";

type DayRange = 7 | 30 | 90;

type UserGrowthPoint = {
  date: string;
  newUsers: number;
  totalUsers: number;
};

type UserGrowthResponse = {
  days: DayRange;
  utcOffsetMinutes: number;
  addedUsers: number;
  points: UserGrowthPoint[];
};

use([
  BarChart,
  LineChart,
  AriaComponent,
  GridComponent,
  LegendComponent,
  TooltipComponent,
  CanvasRenderer
]);

const dayRanges: DayRange[] = [7, 30, 90];
const activeDays = ref<DayRange>(30);
const addedUsers = ref(0);
const points = ref<UserGrowthPoint[]>([]);
const loading = ref(true);
const errorMessage = ref("");
const chartElement = ref<HTMLElement | null>(null);
const { t, localizeError, locale, theme } = usePortalI18n();
let chart: EChartsType | null = null;
let resizeObserver: ResizeObserver | null = null;
let requestSequence = 0;

const hasData = computed(() => points.value.some((point) => point.totalUsers > 0));
const currentUsers = computed(() => points.value.at(-1)?.totalUsers || 0);
const accessibleSummary = computed(() => t("admin.userGrowthAccessibleSummary", {
  days: activeDays.value,
  count: addedUsers.value,
  total: currentUsers.value
}));

function formatChartDate(value: string, full = false) {
  const date = new Date(`${value}T00:00:00`);
  return new Intl.DateTimeFormat(locale.value === "en" ? "en-US" : "zh-CN", full
    ? { year: "numeric", month: "short", day: "numeric" }
    : { month: "numeric", day: "numeric" }
  ).format(date);
}

function chartColors() {
  const styles = getComputedStyle(document.documentElement);
  return {
    text: styles.getPropertyValue("--page-text").trim(),
    muted: styles.getPropertyValue("--page-muted").trim(),
    border: styles.getPropertyValue("--page-border").trim(),
    blue: styles.getPropertyValue("--page-accent-2").trim(),
    warm: styles.getPropertyValue("--page-warm").trim(),
    surface: styles.getPropertyValue("--page-surface-strong").trim()
  };
}

function renderChart() {
  if (!chartElement.value || !points.value.length) {
    return;
  }

  chart ||= init(chartElement.value);
  const colors = chartColors();
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const dailyLabel = t("admin.dailyNewUsers");
  const totalLabel = t("admin.totalUsers");

  chart.setOption({
    animation: !reduceMotion,
    animationDuration: 420,
    aria: {
      enabled: true,
      decal: { show: false }
    },
    color: [colors.warm, colors.blue],
    grid: {
      top: 58,
      right: 48,
      bottom: 40,
      left: 48,
      containLabel: false
    },
    legend: {
      top: 4,
      right: 4,
      itemWidth: 16,
      itemHeight: 8,
      textStyle: { color: colors.muted }
    },
    tooltip: {
      trigger: "axis",
      backgroundColor: colors.surface,
      borderColor: colors.border,
      textStyle: { color: colors.text },
      axisPointer: {
        type: "line",
        lineStyle: { color: colors.border }
      },
      formatter: (params: any) => {
        const rows = Array.isArray(params) ? params : [params];
        const date = rows[0]?.axisValue ? formatChartDate(rows[0].axisValue, true) : "";
        return [
          `<strong>${date}</strong>`,
          ...rows.map((row: any) => `${row.marker}${row.seriesName}: <strong>${Number(row.value).toLocaleString()}</strong>`)
        ].join("<br>");
      }
    },
    xAxis: {
      type: "category",
      boundaryGap: true,
      data: points.value.map((point) => point.date),
      axisLine: { lineStyle: { color: colors.border } },
      axisTick: { show: false },
      axisLabel: {
        color: colors.muted,
        hideOverlap: true,
        formatter: (value: string) => formatChartDate(value)
      }
    },
    yAxis: [
      {
        type: "value",
        minInterval: 1,
        splitNumber: 4,
        axisLabel: { color: colors.muted },
        splitLine: { lineStyle: { color: colors.border, type: "dashed" } }
      },
      {
        type: "value",
        minInterval: 1,
        splitNumber: 4,
        axisLabel: { color: colors.muted },
        splitLine: { show: false }
      }
    ],
    series: [
      {
        name: dailyLabel,
        type: "bar",
        data: points.value.map((point) => point.newUsers),
        barMaxWidth: 24,
        itemStyle: {
          color: colors.warm,
          borderRadius: [4, 4, 0, 0],
          opacity: 0.82
        }
      },
      {
        name: totalLabel,
        type: "line",
        yAxisIndex: 1,
        data: points.value.map((point) => point.totalUsers),
        smooth: 0.22,
        showSymbol: activeDays.value === 7,
        symbolSize: 7,
        lineStyle: { color: colors.blue, width: 3 },
        itemStyle: { color: colors.blue },
        areaStyle: { color: "rgba(143, 180, 255, 0.12)" }
      }
    ]
  }, true);
}

async function loadGrowth() {
  const sequence = ++requestSequence;
  loading.value = true;
  errorMessage.value = "";

  try {
    const result = await $fetch<UserGrowthResponse>("/api/admin/user-growth", {
      query: {
        days: activeDays.value,
        utcOffsetMinutes: -new Date().getTimezoneOffset()
      }
    });

    if (sequence !== requestSequence) {
      return;
    }

    addedUsers.value = result.addedUsers;
    points.value = result.points;
    await nextTick();
    renderChart();
  } catch (error: any) {
    if (sequence !== requestSequence) {
      return;
    }

    points.value = [];
    addedUsers.value = 0;
    chart?.clear();
    errorMessage.value = localizeError(error, "error.loadUserGrowth");
  } finally {
    if (sequence === requestSequence) {
      loading.value = false;
    }
  }
}

function selectRange(days: DayRange) {
  if (activeDays.value === days) {
    return;
  }

  activeDays.value = days;
  void loadGrowth();
}

function resizeChart() {
  chart?.resize();
}

watch([theme, locale], async () => {
  await nextTick();
  renderChart();
});

onMounted(() => {
  resizeObserver = new ResizeObserver(resizeChart);
  if (chartElement.value) {
    resizeObserver.observe(chartElement.value);
  }
  window.addEventListener("resize", resizeChart);
  void loadGrowth();
});

onBeforeUnmount(() => {
  requestSequence += 1;
  resizeObserver?.disconnect();
  window.removeEventListener("resize", resizeChart);
  chart?.dispose();
  chart = null;
});
</script>

<style scoped>
.growth-card {
  margin-top: 16px;
  padding: 18px;
  overflow: hidden;
}

.growth-card__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
  margin-bottom: 8px;
}

.growth-card__title {
  margin: 0;
  font-size: 18px;
  line-height: 1.2;
}

.growth-card__meta {
  margin: 6px 0 0;
  color: var(--page-muted);
  font-size: 13px;
}

.range-switch {
  display: inline-grid;
  grid-template-columns: repeat(3, minmax(64px, 1fr));
  flex: 0 0 auto;
  padding: 3px;
  border: 1px solid var(--page-border);
  border-radius: 8px;
  background: var(--page-surface-soft);
}

.range-switch__button {
  min-height: 34px;
  padding: 0 12px;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: var(--page-muted);
  cursor: pointer;
  font: inherit;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0;
  transition: background-color 160ms ease, color 160ms ease;
}

.range-switch__button:hover,
.range-switch__button:focus-visible {
  color: var(--page-text);
}

.range-switch__button:focus-visible {
  outline: 2px solid var(--page-accent-2);
  outline-offset: -2px;
}

.range-switch__button--active {
  background: var(--page-accent);
  color: var(--page-bg);
}

.range-switch__button:disabled {
  cursor: wait;
}

.growth-chart-shell {
  position: relative;
  width: 100%;
  height: 320px;
  min-height: 320px;
}

.growth-chart {
  width: 100%;
  height: 100%;
  transition: opacity 160ms ease;
}

.growth-chart--muted {
  opacity: 0.16;
}

.growth-chart-state {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 12px;
  color: var(--page-muted);
  font-size: 13px;
  text-align: center;
}

.growth-chart-state p {
  margin: 0;
}

.growth-chart-state--loading {
  flex-direction: row;
}

.growth-chart-state__pulse {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: var(--page-accent-2);
  box-shadow: 0 0 0 6px rgba(143, 180, 255, 0.12);
  animation: growth-pulse 1.2s ease-in-out infinite;
}

.growth-chart-state__button {
  min-height: 38px;
  padding: 8px 16px;
}

.growth-chart-summary {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

@keyframes growth-pulse {
  50% {
    opacity: 0.45;
    transform: scale(0.82);
  }
}

@media (max-width: 720px) {
  .growth-card__header {
    flex-direction: column;
  }

  .range-switch {
    width: 100%;
  }

  .growth-chart-shell {
    height: 280px;
    min-height: 280px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .range-switch__button,
  .growth-chart {
    transition: none;
  }

  .growth-chart-state__pulse {
    animation: none;
  }
}
</style>
