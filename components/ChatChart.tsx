"use client";

import { useEffect, useRef, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ChartDataset {
    label?: string;
    data: number[];
}

export interface ChatChartData {
    type: "pie" | "donut" | "bar" | "line" | "area" | "horizontalBar"
    | "daywise" | "tree" | "radar" | "stackedBar" | "yearlyStackedBar";
    title: string;
    currency: string;
    labels?: string[];
    datasets?: ChartDataset[];
    creditSeries?: [number, number][];
    debitSeries?: [number, number][];
    nodes?: { id: string; name: string; value: number; parent: string | null; pct?: string }[];
    totalDebit?: number;
}

interface ChatChartProps {
    chartData: ChatChartData;
    fullscreen?: boolean;
}

// ─── Colors ───────────────────────────────────────────────────────────────────

const PIE_COLORS = ["#3b82f6", "#00b4d8", "#22c55e", "#60d394", "#f59e0b", "#f4a261", "#9d4edd", "#ff4d6d", "#ffc107", "#20c997"];
const STACKED_COLORS = ["#ffc107", "#95c623", "#20c997", "#d00000", "#9d4edd", "#f77f00", "#4c9bfd", "#0dcaf0", "#ff4d6d", "#51291e"];
const TREE_COLORS = { root: "#e36414", yearNode: "#0077b6", circle: "#6a994e", diamond: "#02c39a" };
const RADAR_CREDIT = "#60d394";
const RADAR_DEBIT = "#ef4444";
const DAYWISE_CREDIT = "#10B981";
const DAYWISE_DEBIT = "#EF4444";

function fmt(val: number, currency: string) {
    return `${currency}${Math.round(val).toLocaleString("en-IN")}`;
}

function fmtCompact(val: number, currency: string) {
    if (val >= 1000000) return `${currency}${(val / 1000000).toFixed(1)}M`;
    if (val >= 100000) return `${currency}${(val / 100000).toFixed(1)}L`;
    if (val >= 1000) return `${currency}${(val / 1000).toFixed(1)}k`;
    return `${currency}${Math.round(val)}`;
}

// ─── Highcharts loader ────────────────────────────────────────────────────────

let HC: any = null;
let hcLoading = false;
const hcCbs: (() => void)[] = [];

function loadHighcharts(cb: () => void) {
    if (typeof window === "undefined") return;
    if (HC) { cb(); return; }
    hcCbs.push(cb);
    if (hcLoading) return;
    hcLoading = true;
    const BASE = "https://cdnjs.cloudflare.com/ajax/libs/highcharts/11.2.0";
    const load = (src: string, next: () => void) => {
        const s = document.createElement("script");
        s.src = src; s.onload = next;
        document.head.appendChild(s);
    };
    load(`${BASE}/highstock.js`, () =>
        load(`${BASE}/highcharts-more.js`, () => {
            HC = (window as any).Highcharts;
            hcCbs.forEach(fn => fn());
            hcCbs.length = 0;
        })
    );
}

// ─── ECharts loader ───────────────────────────────────────────────────────────

let EC: any = null;
let ecLoading = false;
const ecCbs: (() => void)[] = [];

function loadECharts(cb: () => void) {
    if (typeof window === "undefined") return;
    if (EC) { cb(); return; }
    ecCbs.push(cb);
    if (ecLoading) return;
    ecLoading = true;
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/echarts/5.4.3/echarts.min.js";
    s.onload = () => { EC = (window as any).echarts; ecCbs.forEach(fn => fn()); ecCbs.length = 0; };
    document.head.appendChild(s);
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ChatChart({ chartData, fullscreen = false }: ChatChartProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const instanceRef = useRef<any>(null);
    const [ready, setReady] = useState(false);

    const { type, title, currency } = chartData;

    const usesHighcharts = ["pie", "donut", "bar", "line", "area", "daywise", "horizontalBar", "stackedBar", "yearlyStackedBar"].includes(type);
    const usesECharts = ["tree", "radar"].includes(type);

    const chartHeight = (() => {
        if (type === "tree") {
            const nodeCount = chartData.nodes ? chartData.nodes.filter(n => n.parent === "root").length : 4;
            return fullscreen ? Math.max(500, nodeCount * 80 + 80) : Math.max(380, nodeCount * 65 + 60);
        }
        if (type === "yearlyStackedBar") {
            const yearCount = chartData.labels?.length || 4;
            return Math.max(fullscreen ? 320 : 260, yearCount * 60 + 100);
        }
        if (type === "radar") return fullscreen ? 420 : 360;
        if (type === "pie" || type === "donut") return fullscreen ? 340 : 300;
        if (type === "daywise") return fullscreen ? 400 : 340;
        if (type === "horizontalBar") return Math.max((chartData.labels?.length || 4) * 48 + 80, fullscreen ? 280 : 220);
        if (type === "stackedBar") return fullscreen ? 380 : 320;
        return fullscreen ? 360 : 300;
    })();

    useEffect(() => {
        if (usesHighcharts) loadHighcharts(() => setReady(true));
        else if (usesECharts) loadECharts(() => setReady(true));
        else setReady(true);
    }, []);

    useEffect(() => {
        if (!ready || !containerRef.current) return;
        try {
            if (instanceRef.current?.dispose) instanceRef.current.dispose();
            else if (instanceRef.current?.destroy) instanceRef.current.destroy();
        } catch (_) { }
        instanceRef.current = null;

        if (usesHighcharts && HC) renderHighcharts();
        else if (usesECharts && EC) renderECharts();

        return () => {
            try {
                if (instanceRef.current?.dispose) instanceRef.current.dispose();
                else if (instanceRef.current?.destroy) instanceRef.current.destroy();
            } catch (_) { }
            instanceRef.current = null;
        };
    }, [ready, chartData, fullscreen]);

    function renderHighcharts() {
        const el = containerRef.current!;
        const { labels = [], datasets = [] } = chartData;

        // ── PIE / DONUT ──
        if (type === "pie" || type === "donut") {
            instanceRef.current = HC.chart(el, {
                accessibility: { enabled: false },
                chart: { type: "pie", backgroundColor: "transparent", animation: true, height: chartHeight },
                title: { text: undefined },
                credits: { enabled: false },
                exporting: { enabled: false },
                tooltip: {
                    pointFormat: `<b>{point.name}</b><br/>${currency}{point.y:,.0f} ({point.percentage:.1f}%)`,
                    backgroundColor: "#ffffff",
                },
                plotOptions: {
                    pie: {
                        allowPointSelect: true, borderRadius: 5, cursor: "pointer",
                        depth: 45, innerSize: "50%", showInLegend: true,
                        borderWidth: 3, borderColor: "#ffffff",
                        dataLabels: { enabled: true, format: "{point.name}: {point.percentage:.1f}%", style: { fontSize: "11px" } },
                        animation: { duration: 1200 },
                    },
                },
                colors: PIE_COLORS,
                legend: { layout: "horizontal", align: "center", verticalAlign: "bottom", itemStyle: { color: "#444", fontWeight: "500", fontSize: "12px" } },
                series: [{
                    type: "pie", name: "Expenses",
                    data: (datasets[0]?.data || []).map((val, i) => ({
                        name: labels[i] || `Item ${i + 1}`, y: val, color: PIE_COLORS[i % PIE_COLORS.length],
                    })),
                }],
            });
            return;
        }

        // ── DAYWISE ──
        if (type === "daywise") {
            const { creditSeries = [], debitSeries = [] } = chartData;
            instanceRef.current = HC.stockChart(el, {
                chart: { height: chartHeight, backgroundColor: "transparent" },
                title: { text: undefined }, credits: { enabled: false }, exporting: { enabled: false }, accessibility: { enabled: false },
                rangeSelector: {
                    selected: 1,
                    buttons: [
                        { type: "month", count: 1, text: "1m" }, { type: "month", count: 3, text: "3m" },
                        { type: "month", count: 6, text: "6m" }, { type: "year", count: 1, text: "1y" }, { type: "all", text: "All" },
                    ],
                    inputEnabled: false,
                    buttonTheme: { fill: "#f3f4f6", style: { color: "#374151" }, states: { select: { fill: "#3b82f6", style: { color: "#fff" } } } },
                },
                xAxis: { type: "datetime", labels: { style: { color: "#374151" } }, lineColor: "#d1d5db", tickColor: "#d1d5db" },
                yAxis: {
                    opposite: false, title: { text: `Amount (${currency})` },
                    labels: {
                        formatter(this: Highcharts.AxisLabelsFormatterContextObject) {
                            return fmt(this.value as number, currency);
                        },
                        style: { color: "#374151" }
                    },
                    gridLineColor: "#e5e7eb",
                },
                tooltip: {
                    shared: true, backgroundColor: "#ffffff", borderColor: "#d1d5db", style: { color: "#111827", fontSize: "13px" },
                    pointFormatter() { return `<span style="color:${(this as any).color}">\u25CF</span> <b>${(this as any).series.name}: ${currency}${HC.numberFormat((this as any).y!, 0, ".", ",")}</b><br/>`; },
                },
                plotOptions: { spline: { marker: { enabled: true, radius: 3, symbol: "circle" }, states: { hover: { lineWidth: 4 } } } },
                legend: { layout: "horizontal", align: "center", verticalAlign: "bottom", itemStyle: { color: "#111827", fontSize: "13px" } },
                series: [
                    { name: "Credit", data: creditSeries.map(([x, y]) => ({ x, y, marker: { enabled: y > 0 } })), type: "spline", color: DAYWISE_CREDIT, lineWidth: 2 },
                    { name: "Debit", data: debitSeries.map(([x, y]) => ({ x, y, marker: { enabled: y > 0 } })), type: "spline", color: DAYWISE_DEBIT, lineWidth: 2 },
                ],
            });
            return;
        }

        // ── BAR ──
        if (type === "bar") {
            const seriesColors = ["#2563eb", "#22c55e"];
            instanceRef.current = HC.chart(el, {
                accessibility: { enabled: false },
                chart: { type: "column", backgroundColor: "transparent", height: chartHeight },
                title: { text: undefined }, credits: { enabled: false }, exporting: { enabled: false },
                xAxis: { categories: labels, labels: { style: { color: "#374151" } }, lineColor: "#e5e7eb", tickColor: "#e5e7eb" },
                yAxis: {
                    title: { text: `Amount (${currency})`, style: { color: "#374151" } },
                    labels: {
                        formatter(this: Highcharts.AxisLabelsFormatterContextObject) {
                            return fmt(this.value as number, currency);
                        },
                        style: { color: "#374151" }
                    },
                    gridLineColor: "#e5e7eb",
                },
                tooltip: {
                    shared: true, backgroundColor: "#ffffff", borderColor: "#e5e7eb", style: { color: "#111827", fontSize: "12px" },
                    pointFormatter() { return `<span style="color:${(this as any).color}">\u25CF</span> ${(this as any).series.name}: <b>${fmt((this as any).y!, currency)}</b><br/>`; },
                },
                legend: { enabled: datasets.length > 1, layout: "horizontal", align: "center", verticalAlign: "bottom", itemStyle: { color: "#374151", fontSize: "12px" } },
                plotOptions: { column: { grouping: true, borderRadius: 4 } },
                series: datasets.map((ds, i) => ({
                    name: ds.label || `Series ${i + 1}`, type: "column" as const, data: ds.data,
                    color: seriesColors[i % seriesColors.length] + "cc",
                    borderColor: seriesColors[i % seriesColors.length], borderWidth: 1, borderRadius: 4,
                })),
            });
            return;
        }

        // ── LINE / AREA ──
        if (type === "line" || type === "area") {
            const lineColors = ["#ef4444", "#22c55e"];
            instanceRef.current = HC.chart(el, {
                accessibility: { enabled: false },
                chart: { type: "spline", backgroundColor: "transparent", height: chartHeight },
                title: { text: undefined }, credits: { enabled: false }, exporting: { enabled: false },
                xAxis: { categories: labels, labels: { style: { color: "#4b5563" } }, gridLineColor: "#e5e7eb", lineColor: "#e5e7eb", tickColor: "#e5e7eb" },
                yAxis: {
                    title: { text: `Total Expenses (${currency})`, style: { color: "#4b5563" } },
                    labels: {
                        formatter(this: Highcharts.AxisLabelsFormatterContextObject) {
                            return fmt(this.value as number, currency);
                        },
                        style: { color: "#4b5563" }
                    },
                    gridLineColor: "#e5e7eb",
                },
                legend: { align: "center", verticalAlign: "bottom", layout: "horizontal", backgroundColor: "#ffffff", itemStyle: { color: "#1f2937", fontWeight: "500", fontSize: "12px" }, borderColor: "#e5e7eb", symbolWidth: 40 },
                tooltip: {
                    shared: true, backgroundColor: "#ffffff", style: { color: "#1f2937" },
                    pointFormatter() { return `<span style="color:${(this as any).color}">\u25CF</span> ${(this as any).series.name}: <b>${fmt((this as any).y!, currency)}</b><br/>`; },
                },
                plotOptions: {
                    series: { connectNulls: true, marker: { enabled: true, radius: 4 }, cursor: "pointer", lineWidth: 2 },
                    areaspline: { fillOpacity: 0.15 },
                },
                series: datasets.map((ds, i) => {
                    const color = lineColors[i % lineColors.length];
                    return {
                        name: ds.label || `Series ${i + 1}`,
                        type: type === "area" ? "areaspline" as const : "spline" as const,
                        data: ds.data, color,
                        fillColor: type === "area"
                            ? { linearGradient: { x1: 0, y1: 0, x2: 0, y2: 1 }, stops: [[0, color + "55"], [1, color + "00"]] }
                            : undefined,
                    };
                }),
            });
            return;
        }

        // ── HORIZONTAL BAR ──
        if (type === "horizontalBar") {
            instanceRef.current = HC.chart(el, {
                accessibility: { enabled: false },
                chart: { type: "bar", backgroundColor: "transparent", height: chartHeight },
                title: { text: undefined }, credits: { enabled: false }, exporting: { enabled: false },
                colors: STACKED_COLORS,
                xAxis: { categories: labels, crosshair: true, labels: { style: { color: "#374151", fontSize: "11px" } } },
                yAxis: {
                    min: 0, title: { text: `Amount (${currency})` },
                    labels: {
                        formatter(this: Highcharts.AxisLabelsFormatterContextObject) {
                            const v = this.value as number;

                            if (v >= 1000000) return currency + (v / 1000000).toFixed(1) + "M";
                            if (v >= 1000) return currency + (v / 1000).toFixed(0) + "k";

                            return currency + HC.numberFormat(v, 0, ".", ",");
                        },
                    },
                },
                tooltip: {
                    shared: true, useHTML: true, backgroundColor: "#ffffff", style: { color: "#111827", padding: "10px", fontSize: "13px" },
                    formatter() {
                        let total = 0;
                        let html = `<b>${(this as any).points?.[0]?.key || ""}</b><br/>`;
                        (this as any).points?.forEach((p: any) => {
                            const v = Number(p.y || 0); total += v;
                            html += `<span style="color:${p.color}">●</span> ${p.series.name}: <b>${fmt(v, currency)}</b><br/>`;
                        });
                        html += `<hr style="border:none;border-top:1px solid #e5e7eb;margin:6px 0"/><b>Total: ${fmt(total, currency)}</b>`;
                        return html;
                    },
                },
                legend: { itemStyle: { color: "#111827", fontSize: "12px" }, itemHoverStyle: { color: "#000000" } },
                plotOptions: {
                    bar: {
                        stacking: "normal", minPointLength: 35,
                        dataLabels: {
                            enabled: true,
                            formatter() {
                                const v = (this as any).y;
                                if (v >= 1000000) return currency + (v / 1000000).toFixed(2) + "M";
                                if (v >= 1000) return currency + (v / 1000).toFixed(2) + "k";
                                return currency + Number(v).toLocaleString();
                            },
                            style: { textOutline: "none", fontSize: "10px" },
                        },
                    },
                },
                series: datasets.map((ds, i) => ({
                    name: ds.label || `Category ${i + 1}`, type: "bar" as const, data: ds.data,
                    color: STACKED_COLORS[i % STACKED_COLORS.length],
                })),
            });
            return;
        }

        // ── STACKED BAR ──
        if (type === "stackedBar") {
            instanceRef.current = HC.chart(el, {
                accessibility: { enabled: false },
                chart: { type: "column", backgroundColor: "transparent", height: chartHeight },
                title: { text: undefined }, credits: { enabled: false }, exporting: { enabled: false },
                colors: STACKED_COLORS,
                xAxis: { categories: labels, crosshair: true, labels: { style: { color: "#374151", fontSize: "11px" } } },
                yAxis: {
                    min: 0, title: { text: `Amount (${currency})` },
                    labels: {
                        formatter() {
                            const v = (this as any).value as number;

                            if (v >= 1000) return currency + (v / 1000).toFixed(0) + "k";
                            return currency + HC.numberFormat(v, 0, ".", ",");
                        },
                    },
                    gridLineColor: "#f3f4f6",
                },
                tooltip: {
                    shared: true, useHTML: true, backgroundColor: "#ffffff", style: { color: "#111827", padding: "10px", fontSize: "13px" },
                    formatter() {
                        let total = 0;
                        let html = `<b>${(this as any).points?.[0]?.key || ""}</b><br/>`;
                        (this as any).points?.forEach((p: any) => {
                            if (p.y > 0) { total += p.y; html += `<span style="color:${p.color}">●</span> ${p.series.name}: <b>${fmt(p.y, currency)}</b><br/>`; }
                        });
                        html += `<hr style="border:none;border-top:1px solid #e5e7eb;margin:6px 0"/><b>Total: ${fmt(total, currency)}</b>`;
                        return html;
                    },
                },
                legend: { itemStyle: { color: "#111827", fontSize: "12px" } },
                plotOptions: {
                    column: {
                        stacking: "normal",
                        dataLabels: {
                            enabled: true,
                            formatter() {
                                const v = (this as any).y;
                                if (!v || v === 0) return "";
                                if (v >= 1000) return currency + (v / 1000).toFixed(0) + "k";
                                return currency + v;
                            },
                            color: "#111827", style: { textOutline: "none", fontSize: "10px" },
                        },
                    },
                },
                series: datasets.map((ds, i) => ({
                    name: ds.label || `Category ${i + 1}`, type: "column" as const, data: ds.data,
                    color: STACKED_COLORS[i % STACKED_COLORS.length],
                })),
            });
            return;
        }

        // ── YEARLY STACKED BAR ──
        if (type === "yearlyStackedBar") {
            instanceRef.current = HC.chart(el, {
                accessibility: { enabled: false },
                chart: { type: "bar", backgroundColor: "transparent", height: chartHeight },
                title: { text: undefined },
                credits: { enabled: false },
                exporting: { enabled: false },
                colors: STACKED_COLORS,
                xAxis: {
                    categories: labels,
                    crosshair: true,
                    labels: { style: { color: "#374151", fontSize: "12px", fontWeight: "600" } },
                    title: { text: undefined },
                },
                yAxis: {
                    min: 0,
                    title: { text: `Amount (${currency})`, style: { color: "#374151" } },
                    labels: {
                        formatter(this: Highcharts.AxisLabelsFormatterContextObject) {
                            const v = this.value as number;

                            if (v >= 1000000) return currency + (v / 1000000).toFixed(1) + "M";
                            if (v >= 100000) return currency + (v / 100000).toFixed(1) + "L";
                            if (v >= 1000) return currency + (v / 1000).toFixed(0) + "k";

                            return currency + HC.numberFormat(v, 0, ".", ",");
                        },
                        style: { color: "#374151" },
                    },
                    gridLineColor: "#e5e7eb",
                    stackLabels: {
                        enabled: true,
                        formatter() {
                            const v = (this as any).total as number;
                            if (!v) return "";
                            if (v >= 100000) return currency + (v / 100000).toFixed(1) + "L";
                            if (v >= 1000) return currency + (v / 1000).toFixed(1) + "k";
                            return currency + v;
                        },
                        style: { fontWeight: "700", color: "#1e293b", textOutline: "none", fontSize: "11px" },
                    },
                },
                tooltip: {
                    shared: true,
                    useHTML: true,
                    backgroundColor: "#ffffff",
                    borderColor: "#e5e7eb",
                    style: { color: "#111827", padding: "10px", fontSize: "13px" },
                    formatter() {
                        let total = 0;
                        const year = (this as any).points?.[0]?.key || "";
                        let html = `<div style="font-weight:700;margin-bottom:6px;font-size:13px">📅 ${year}</div>`;
                        const pts = ((this as any).points || []).filter((p: any) => p.y > 0);
                        pts.sort((a: any, b: any) => b.y - a.y);
                        pts.forEach((p: any) => {
                            total += p.y;
                            html += `<div style="display:flex;justify-content:space-between;gap:16px;margin:2px 0">
                                <span><span style="color:${p.color};font-size:14px">●</span> ${p.series.name}</span>
                                <b>${fmt(p.y, currency)}</b>
                            </div>`;
                        });
                        html += `<div style="border-top:1px solid #e5e7eb;margin-top:6px;padding-top:5px;display:flex;justify-content:space-between">
                            <span style="font-weight:700">Total</span><b>${fmt(total, currency)}</b>
                        </div>`;
                        return `<div style="padding:2px">${html}</div>`;
                    },
                },
                legend: {
                    layout: "horizontal",
                    align: "center",
                    verticalAlign: "bottom",
                    itemStyle: { color: "#111827", fontSize: "11px" },
                    itemHoverStyle: { color: "#000000" },
                },
                plotOptions: {
                    bar: {
                        stacking: "normal",
                        dataLabels: {
                            enabled: true,
                            formatter() {
                                const v = (this as any).y as number;
                                if (!v || v === 0) return "";
                                if (v >= 100000) return currency + (v / 100000).toFixed(1) + "L";
                                if (v >= 1000) return currency + (v / 1000).toFixed(2) + "k";
                                return currency + v;
                            },
                            style: { textOutline: "none", fontSize: "10px", color: "#ffffff", fontWeight: "600" },
                            filter: { property: "percentage", operator: ">", value: 5 },
                        },
                        borderRadius: 2,
                        pointPadding: 0.05,
                        groupPadding: 0.1,
                    },
                },
                series: datasets.map((ds, i) => ({
                    name: ds.label || `Category ${i + 1}`,
                    type: "bar" as const,
                    data: ds.data,
                    color: STACKED_COLORS[i % STACKED_COLORS.length],
                })),
            });
            return;
        }
    }

    // ── ECHARTS ──────────────────────────────────────────────────────────────
    function renderECharts() {
        const el = containerRef.current!;
        const { labels = [], datasets = [] } = chartData;
        const chart = EC.init(el);
        instanceRef.current = chart;

        // ── RADAR ──
        if (type === "radar") {
            const maxVal = Math.max(...datasets.flatMap(d => d.data), 1000) * 1.15;
            chart.setOption({
                backgroundColor: "transparent",
                tooltip: {
                    trigger: "item", backgroundColor: "#ffffff", borderColor: "#e5e7eb", borderRadius: 8,
                    formatter: (params: any) => {
                        const vals = params.value as number[];
                        const label = params.name;
                        let html = `<div style="font-weight:600;margin-bottom:6px;font-size:12px">${label}</div>`;
                        datasets.forEach((ds, i) => {
                            const color = i === 0 ? RADAR_CREDIT : RADAR_DEBIT;
                            const name = ds.label || (i === 0 ? "Credit" : "Debit");
                            html += `<div style="display:flex;justify-content:space-between;gap:16px;font-size:12px"><span style="color:${color}">${name}: </span><b>${fmt(vals[i] || 0, currency)}</b></div>`;
                        });
                        return `<div style="padding:10px 12px;min-width:130px;background:#fff;border-radius:8px;font-size:12px;box-shadow:0 4px 12px rgba(0,0,0,0.2)">${html}</div>`;
                    },
                },
                legend: { bottom: 0, data: datasets.map((d, i) => d.label || (i === 0 ? "Credit" : "Debit")), textStyle: { fontSize: 12, color: "#374151" }, icon: "circle" },
                radar: {
                    indicator: labels.map(l => ({ name: l, max: maxVal })),
                    radius: "75%", center: ["50%", "48%"],
                    splitLine: { lineStyle: { color: "#e5e7eb", type: [4, 4] } },
                    axisLine: { lineStyle: { color: "#e5e7eb" } },
                    splitArea: { areaStyle: { color: ["#f9fafb", "#ffffff"] } },
                    axisLabel: { fontSize: 9, color: "#9ca3af" },
                    name: { textStyle: { fontSize: 12, color: "#6b7280" } },
                },
                series: [{
                    type: "radar",
                    data: datasets.map((ds, i) => {
                        const color = i === 0 ? RADAR_CREDIT : RADAR_DEBIT;
                        return {
                            name: ds.label || (i === 0 ? "Credit" : "Debit"),
                            value: ds.data,
                            areaStyle: { opacity: 0.4, color },
                            lineStyle: { color, width: 2 },
                            itemStyle: { color },
                        };
                    }),
                }],
            });
            return;
        }

        // ── TREE ──
        if (type === "tree") {
            const { nodes = [], totalDebit = 0 } = chartData;
            const branches = nodes.filter(n => n.parent === "root");
            const children = branches.map((n) => {
                const sizeRatio = totalDebit > 0 ? n.value / totalDebit : 0;
                const symSize = Math.max(14, Math.min(40, Math.round(sizeRatio * 100)));
                return {
                    name: n.name, value: n.value, symbolSize: symSize, symbol: "circle",
                    itemStyle: { color: TREE_COLORS.circle, borderColor: TREE_COLORS.circle, borderWidth: 1 },
                    label: {
                        show: true, position: "right", verticalAlign: "middle", align: "left",
                        fontSize: fullscreen ? 13 : 11, color: "#111827",
                        formatter: () => [`{name|${n.name}}`, `{val|${fmtCompact(n.value, currency)}}`, `{pct|(${n.pct}%)}`].join("\n"),
                        rich: {
                            name: { fontSize: fullscreen ? 13 : 11, fontWeight: "600", color: "#1e293b", lineHeight: 18 },
                            val: { fontSize: fullscreen ? 12 : 10, color: "#374151", lineHeight: 16 },
                            pct: { fontSize: fullscreen ? 11 : 9, color: "#6b7280", lineHeight: 15 },
                        },
                    },
                };
            });
            const treeData = [{
                name: "All\nExpenses", value: totalDebit,
                symbolSize: fullscreen ? 30 : 24, symbol: "diamond",
                itemStyle: { color: TREE_COLORS.root, borderColor: TREE_COLORS.root, borderWidth: 2 },
                label: {
                    show: true, position: "left", verticalAlign: "middle", align: "right",
                    formatter: () => [`{title|All Expenses}`, `{total|${fmtCompact(totalDebit, currency)}}`].join("\n"),
                    rich: {
                        title: { fontSize: fullscreen ? 13 : 11, fontWeight: "700", color: "#1e293b", lineHeight: 18 },
                        total: { fontSize: fullscreen ? 13 : 11, color: "#3b82f6", fontWeight: "600", lineHeight: 18 },
                    },
                },
                children,
            }];
            const maxLabelLen = Math.max(...branches.map(n => n.name.length), 4);
            const rightMargin = Math.min(40, Math.max(22, maxLabelLen * 1.4)) + "%";
            chart.setOption({
                backgroundColor: "transparent",
                tooltip: {
                    trigger: "item", triggerOn: "mousemove",
                    backgroundColor: "#f9fafb", borderColor: "#e5e7eb", textStyle: { color: "#111827" },
                    formatter: (params: any) => {
                        if (!params.data.value) return `<b>${params.data.name.replace(/\n/g, " ")}</b>`;
                        const pct = totalDebit > 0 ? ((params.data.value / totalDebit) * 100).toFixed(1) : "0";
                        return `<b>${params.data.name.replace(/\n/g, " ")}</b><br/>Amount: <b>${fmt(params.data.value, currency)}</b><br/>Share: <b>${pct}%</b>`;
                    },
                },
                series: [{
                    type: "tree", data: treeData, layout: "orthogonal", orient: "LR",
                    top: "1%", left: "15%", bottom: "1%", right: rightMargin,
                    symbolSize: 14, lineStyle: { color: "#d1d5db", width: 1.5 },
                    label: { show: false }, leaves: { label: { show: false } },
                    expandAndCollapse: true, emphasis: { focus: "descendant" },
                    initialTreeDepth: 2, animationDuration: 350, animationDurationUpdate: 350, nodePadding: 25,
                }],
            });
            try {
                const ro = new ResizeObserver(() => chart.resize());
                ro.observe(el);
                const orig = chart.dispose.bind(chart);
                chart.dispose = () => { ro.disconnect(); orig(); };
            } catch (_) { }
        }
    }

    // ── Header values ──
    const pieTotal = (type === "pie" || type === "donut")
        ? (chartData.datasets?.[0]?.data ?? []).reduce((a, b) => a + b, 0) : 0;
    const treeTotal = type === "tree" ? (chartData.totalDebit || 0) : 0;
    const yearlyTotal = type === "yearlyStackedBar"
        ? (chartData.datasets ?? []).reduce((sum, ds) => sum + ds.data.reduce((a, b) => a + b, 0), 0) : 0;

    return (
        <div style={{ background: "#ffffff", overflow: "hidden" }}>
            {/* Header */}
            <div style={{
                padding: fullscreen ? "10px 16px" : "8px 14px",
                borderBottom: "1px solid #f1f5f9",
                display: "flex", alignItems: "center", justifyContent: "space-between",
                background: "#f8fafc",
            }}>
                <span style={{ fontWeight: 600, color: "#1e293b", fontSize: fullscreen ? "13px" : "12px" }}>
                    📊 {title}
                </span>
                <span style={{ color: "#64748b", fontSize: "11px", marginLeft: 8, flexShrink: 0 }}>
                    {pieTotal > 0 ? `Total: ${fmt(pieTotal, currency)}` :
                        treeTotal > 0 ? `Total: ${fmt(treeTotal, currency)}` :
                            yearlyTotal > 0 ? `All-time: ${fmt(yearlyTotal, currency)}` :
                                type === "daywise" ? "Daily view • Credit / Debit" : ""}
                </span>
            </div>

            {/* Legend for bar/area */}
            {["bar", "area"].includes(type) && (chartData.datasets?.length || 0) > 1 && (
                <div style={{ display: "flex", gap: "14px", padding: "6px 14px 4px", flexWrap: "wrap" }}>
                    {chartData.datasets!.map((ds, i) => {
                        const colors = type === "bar" ? ["#2563eb", "#22c55e"] : ["#ef4444", "#22c55e"];
                        return (
                            <span key={i} style={{ display: "flex", alignItems: "center", gap: "5px", color: "#64748b", fontSize: "11px" }}>
                                <span style={{ width: 10, height: 10, borderRadius: 2, background: colors[i % colors.length], flexShrink: 0 }} />
                                {ds.label}
                            </span>
                        );
                    })}
                </div>
            )}

            {/* Daywise legend */}
            {type === "daywise" && (
                <div style={{ display: "flex", justifyContent: "center", gap: "16px", padding: "6px 14px 0", fontSize: "12px" }}>
                    <span style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                        <span style={{ width: 10, height: 10, borderRadius: "50%", background: DAYWISE_CREDIT, display: "inline-block" }} />Credit
                    </span>
                    <span style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                        <span style={{ width: 10, height: 10, borderRadius: "50%", background: DAYWISE_DEBIT, display: "inline-block" }} />Debit
                    </span>
                </div>
            )}

            {/* Chart container */}
            <div style={{ padding: fullscreen ? "10px 14px 14px" : "8px 10px 10px" }}>
                {!ready ? (
                    <div style={{ height: `${chartHeight}px`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <div style={{ textAlign: "center" }}>
                            {(type === "pie" || type === "donut" || type === "radar") ? (
                                <div style={{ width: fullscreen ? 200 : 160, height: fullscreen ? 200 : 160, borderRadius: "50%", background: "#e5e7eb", animation: "pulse 1.5s infinite" }} />
                            ) : (
                                <div style={{ width: 200, height: 60, background: "#e5e7eb", borderRadius: 8, animation: "pulse 1.5s infinite" }} />
                            )}
                        </div>
                    </div>
                ) : (
                    <div ref={containerRef} style={{ width: "100%", height: `${chartHeight}px` }} />
                )}
            </div>
        </div>
    );
}