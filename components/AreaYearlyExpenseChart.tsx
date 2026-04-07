"use client";
import React, { useEffect, useState, useMemo } from "react";
import ReactECharts from "echarts-for-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { useAuth } from "@/context/auth-context";
import { apiService } from "@/lib/apiService";
import { ExpenseData } from "@/lib/types";

interface AreaYearlyExpenseChart {
  years: number[];
  currency: string;
  selectedGlobalYear: number;
}

export const AreaYearlyExpenseChart: React.FC<AreaYearlyExpenseChart> = ({
  years,
  currency,
  selectedGlobalYear
}) => {
  const currentYear = new Date().getFullYear();
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [selectedYear, setSelectedYear] = useState(selectedGlobalYear || currentYear);
  const [monthlyExpenseData, setMonthlyExpenseData] = useState<ExpenseData[]>([]);
  const [loading, setLoading] = useState(true); // track loading
  const { user } = useAuth();
  const groupId = user?.groupId;

  useEffect(() => {
    const clampedYear = Math.min(selectedGlobalYear, currentYear);
    setSelectedYear(clampedYear); // Sync with global year when it changes, but clamp to current year
  }, [selectedGlobalYear]);

  useEffect(() => {
    const checkDarkMode = () =>
      document.documentElement.classList.contains("dark");
    setIsDarkMode(checkDarkMode());
    const observer = new MutationObserver(() => {
      setIsDarkMode(checkDarkMode());
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"]
    });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      if (!groupId) {
        setLoading(false);
        setMonthlyExpenseData([]);
        return;
      }
      setLoading(true);
      try {
        const data = await apiService.getYearlyExpense(groupId, selectedYear);
        const allMonths = [
          "Jan", "Feb", "Mar", "Apr", "May", "Jun",
          "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
        ];
        let visibleMonths = allMonths;
        if (selectedYear === currentYear) {
          // find last month which has any data
          const lastDataMonthIndex = data.reduce((lastIdx: number, item: any) => {
            const idx = parseInt(item.month, 10) - 1;
            if (
              item.totalDebit > 0 ||
              item.totalCredit > 0 ||
              item.balance !== 0
            ) {
              return Math.max(lastIdx, idx);
            }
            return lastIdx;
          }, -1);
          visibleMonths =
            lastDataMonthIndex >= 0
              ? allMonths.slice(0, lastDataMonthIndex + 1)
              : [];
        }
        const transformed = visibleMonths.map((m, idx) => {
          const found = data.find(
            (item: any) => parseInt(item.month, 10) - 1 === idx
          );
          return {
            month: m,
            totalDebit: found?.totalDebit || 0,
            totalCredit: found?.totalCredit || 0,
            netBalance: found?.balance || 0,
            categories: found?.categories || {}, // ✅ DIRECT FROM API
          };
        });
        setMonthlyExpenseData(transformed);
      } catch (err) {
        console.error("Error fetching yearly expense data:", err);
        setMonthlyExpenseData([]);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [selectedYear, groupId, currentYear]);

  // Memoize the formatter function to avoid recreating it on every render
  const tooltipFormatter = useMemo(() => {
    return (params: any) => {
      if (!params?.length) return "";
      const monthIndex = params[0].dataIndex;
      const data = monthlyExpenseData[monthIndex];
      if (!data) return "";
      const categoryHtml = Object.entries(data.categories || {})
        .map(
          ([cat, val]) =>
            `<div style="color:${isDarkMode ? "#d1d5db" : "#666"};">
            ${cat}: ${currency}${val}
          </div>`
        )
        .join("");
      const seriesHtml = params
        .map(
          (p: any) =>
            `<div>
            <span style="color:${p.color};font-weight:600;">●</span>
            ${p.seriesName}: ${currency}${p.value}
          </div>`
        )
        .join("");
      return `
      <strong>${data.month}</strong><br/>
      ${seriesHtml}
      <hr/>
      ${categoryHtml}
    `;
    };
  }, [monthlyExpenseData, isDarkMode, currency]);

  // Memoize series data to avoid recomputing on every render
  const expensesData = useMemo(() => monthlyExpenseData.map((d) => d.totalDebit), [monthlyExpenseData]);
  const creditsData = useMemo(() => monthlyExpenseData.map((d) => d.totalCredit), [monthlyExpenseData]);
  const netBalanceData = useMemo(() => monthlyExpenseData.map((d) => d.netBalance), [monthlyExpenseData]);
  const xAxisData = useMemo(() => monthlyExpenseData.map((d) => d.month), [monthlyExpenseData]);

  // Memoize the entire option object
  const option = useMemo(() => ({
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "cross", crossStyle: { color: "#999" } },
      backgroundColor: isDarkMode ? "#374151" : "#fff",
      borderColor: isDarkMode ? "#4b5563" : "#e5e7eb",
      textStyle: { color: isDarkMode ? "#f9fafb" : "#111827" },
      formatter: tooltipFormatter,
    },
    legend: {
      data: ["Expenses", "Credits", "Net Balance"],
      textStyle: { color: isDarkMode ? "#e5e7eb" : "#374151" },
      align: "right",
      layout: "vertical",
      margin: 0,
      verticalAlign: "middle",
    },
    xAxis: [
      {
        type: "category",
        data: xAxisData,
        axisPointer: { type: "shadow" },
        axisLabel: { color: isDarkMode ? "#d1d5db" : "#374151" },
        axisLine: { lineStyle: { color: isDarkMode ? "#6b7280" : "#9ca3af" } },
      },
    ],
    yAxis: [
      {
        type: "value",
        name: `Amount (${currency})`,
        axisLabel: { formatter: (value: number) => `${currency}${value}`, color: isDarkMode ? "#d1d5db" : "#374151" },
        splitLine: { lineStyle: { color: isDarkMode ? "#4b5563" : "#e5e7eb" } },
      },
      {
        type: "value",
        name: "Net Balance",
        axisLabel: { formatter: (value: number) => `${currency}${value}`, color: isDarkMode ? "#d1d5db" : "#374151" },
        splitLine: { lineStyle: { color: isDarkMode ? "#4b5563" : "#e5e7eb" } },
      },
    ],
    series: [
      {
        name: "Expenses",
        type: "bar",
        tooltip: { valueFormatter: (v: any) => `${currency}${v}` },
        data: expensesData,
        itemStyle: { color: "#2563eb" },
      },
      {
        name: "Credits",
        type: "bar",
        tooltip: { valueFormatter: (v: any) => `${currency}${v}` },
        data: creditsData,
        itemStyle: { color: "#22c55e" },
      },
      {
        name: "Net Balance",
        type: "line",
        yAxisIndex: 1,
        tooltip: { valueFormatter: (v: any) => `${currency}${v}` },
        data: netBalanceData,
        itemStyle: { color: "#f59e0b" },
        smooth: true,
      },
    ],
  }), [tooltipFormatter, xAxisData, expensesData, creditsData, netBalanceData, isDarkMode, currency]);

  const filteredYears = useMemo(() => years.filter((y) => y <= currentYear), [years]);

  return (
    <Card className="shadow-lg border-0 bg-white col-span-1 lg:col-span-3 dark:bg-gray-800">
      <CardHeader className="flex justify-between lg:flex-row flex-col">
        <CardTitle className="text-base font-semibold">Yearly Credit, Debit & Net Balance</CardTitle>
        <select
          className="bg-gray-100 dark:bg-gray-700 border dark:border-gray-600 text-xs text-gray-800 dark:text-white rounded-md px-2 py-1"
          value={selectedYear}
          onChange={(e) => setSelectedYear(Number(e.target.value))}
        >
          {filteredYears.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-[400px] p-4 animate-pulse">
            {/* Y-axis lines */}
            <div className="flex h-full gap-4">
              <div className="flex flex-col justify-between w-8">
                {[...Array(6)].map((_, i) => (
                  <div
                    key={i}
                    className="h-3 bg-gray-200 dark:bg-gray-700 rounded"
                  />
                ))}
              </div>
              {/* Chart bars/lines placeholder */}
              <div className="flex-1 flex items-end gap-2">
                {[...Array(12)].map((_, i) => (
                  <div
                    key={i}
                    className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-t"
                    style={{ height: `${30 + (i % 5) * 10}%` }}
                  />
                ))}
              </div>
            </div>
            {/* X-axis */}
            <div className="mt-4 flex gap-2">
              {[...Array(12)].map((_, i) => (
                <div
                  key={i}
                  className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded"
                />
              ))}
            </div>
          </div>
        ) : monthlyExpenseData.length === 0 ? (
          <div className="h-[400px] flex items-center justify-center text-gray-500 dark:text-gray-400">
            No data available for selected year.
          </div>
        ) : (
          <div className="w-full overflow-x-auto">
            <div className="min-w-[700px]">
              <ReactECharts option={option} style={{ height: "400px" }} />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default AreaYearlyExpenseChart;