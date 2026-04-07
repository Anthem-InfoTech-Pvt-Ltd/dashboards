"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/context/auth-context";
import { apiService } from "@/lib/apiService";

const HighchartsReact = dynamic(() => import("highcharts-react-official"), { ssr: false });

const months = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
interface AnnualCategoryTrendsChart {
  years: number[];
  currency: string;
  selectedGlobalYear: number;
}

export const AnnualCategoryTrendsChart: React.FC<AnnualCategoryTrendsChart> = ({
  years,
  currency,
  selectedGlobalYear
}) => {
  const [Highcharts, setHighcharts] = useState<any>(null);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [selectedYear, setSelectedYear] = useState(selectedGlobalYear || new Date().getFullYear())
  const [categories, setCategories] = useState<string[]>([]);
  const [heatmapData, setHeatmapData] = useState<[number, number, number][]>([]);
  const { user } = useAuth()
  const groupId = user?.groupId

  useEffect(() => {
    setSelectedYear(selectedGlobalYear); // Sync with global year when it changes
  }, [selectedGlobalYear]);

  // Load Highcharts modules
  useEffect(() => {
    (async () => {
      const HC = (await import("highcharts")).default;
      const HCHeatmap = (await import("highcharts/modules/heatmap")).default;
      const HCAccessibility = (await import("highcharts/modules/accessibility")).default;
      const HCExporting = (await import("highcharts/modules/exporting")).default;
      HCHeatmap(HC);
      HCAccessibility(HC);
      HCExporting(HC);
      setHighcharts(HC);
    })();
  }, []);

  // Dark mode detection
  useEffect(() => {
    const check = () => document.documentElement.classList.contains("dark");
    setIsDarkMode(check());
    const observer = new MutationObserver(() => setIsDarkMode(check()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    async function fetchData() {
      if (!groupId) return;

      try {
        // 1) Get Heatmap Category Wise Data
        const categoryData = await apiService.getAnnualCategoryTrends(groupId, selectedYear);
        const newCategories = [...categoryData.categories]; // original categories
        const newHeatmap = [...categoryData.data]; // original heatmap data

        // 2) Get Yearly Debit / Credit Totals
        const totalsRes = await apiService.getYearlyExpense(groupId, selectedYear);

        // Add new category labels
        const debitIndex = newCategories.length;     // fixed row index for debit
        const creditIndex = newCategories.length + 1; // fixed row index for credit

        newCategories.push("Total Debit");
        newCategories.push("Total Credit");

        totalsRes.forEach((item: any) => {
          const monthIndex = Number(item.month) - 1;
          const debitValue = Number(item.totalDebit) || 0;
          const creditValue = Number(item.totalCredit) || 0;

          // Add Debit
          newHeatmap.push([monthIndex, debitIndex, debitValue]);

          // Add Credit
          newHeatmap.push([monthIndex, creditIndex, creditValue]);
        });

        // Ensure every cell exists even if 0
        const fullGrid: [number, number, number][] = [];

        for (let monthIndex = 0; monthIndex < 12; monthIndex++) {
          for (let catIndex = 0; catIndex < newCategories.length; catIndex++) {
            const existing = newHeatmap.find(
              (cell) => cell[0] === monthIndex && cell[1] === catIndex
            );
            fullGrid.push([monthIndex, catIndex, existing ? existing[2] : 0]);
          }
        }

        setCategories(newCategories);
        setHeatmapData(fullGrid);

      } catch (err) {
        console.error(err);
      }
    }

    fetchData();
  }, [selectedYear, groupId]);

  if (!Highcharts || heatmapData.length === 0) {
    return (
      <Card className="col-span-full shadow-md border-0 bg-white dark:bg-gray-800">
        <CardHeader className="flex justify-between lg:flex-row flex-col">
          <CardTitle className="text-lg">Annual Category Trends (Heatmap)</CardTitle>
          <div>
            <div className="w-24 h-6 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
          </div>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-64">
          <div className="w-10 h-10 border-4 border-blue-600 border-dashed rounded-full animate-spin"></div>
        </CardContent>
      </Card>
    );
  }

  const options: Highcharts.Options = {
    chart: {
      type: "heatmap",
      plotBorderWidth: 1,
      backgroundColor: "transparent",
      height: 400,
    },
    title: {
      text: undefined,
      style: {
        color: isDarkMode ? "#fff" : "#000",
        fontSize: "16px",
      },
    },
    xAxis: {
      categories: months,
      labels: { style: { color: isDarkMode ? "#ddd" : "#333" } },
      title: { text: "Months", style: { color: isDarkMode ? "#aaa" : "#444" } },
    },
    yAxis: {
      categories,
      reversed: true,
      title: { text: "Expense Type", style: { color: isDarkMode ? "#aaa" : "#444" } },
      labels: { style: { color: isDarkMode ? "#ddd" : "#333" } },
    },
    colorAxis: {
      min: 0,
      stops: [
        [0, isDarkMode ? "#0f172a" : "#e8f3ff"],
        [0.10, isDarkMode ? "#264fa3" : "#a6ceff"],   // small
        [0.20, isDarkMode ? "#2962d0" : "#85b7ff"],   // low-medium
        [0.40, isDarkMode ? "#3b82f6" : "#78b3ff"],   // medium
        [0.55, isDarkMode ? "#4a90ff" : "#559fff"],   // medium-high
        [0.70, isDarkMode ? "#4e9bff" : "#468cff"],   // high-medium
        [0.85, isDarkMode ? "#57b0ff" : "#1f6ed8"],   // high
        [1, isDarkMode ? "#60a5fa" : "#1d4ed8"],       // max → strong blue
      ],
    },

    legend: {
      align: "right",
      layout: "vertical",
      margin: 0,
      verticalAlign: "middle",
      symbolHeight: 200,
      itemStyle: { color: isDarkMode ? "#eee" : "#333" },
    },
    tooltip: {
      useHTML: true,
      formatter: function () {
        const point = this.point as any;
        const category = categories[point.y];

        return `
      <div style="padding:6px;">
        <strong>${months[point.x]}</strong><br/>
        <strong>${category}:</strong> ${currency} ${point.value}
      </div>
    `;
      }
    },
    series: [
      {
        name: "Expenses",
        borderWidth: 1,
        borderColor: isDarkMode ? "#444" : "#fff",
        data: heatmapData,
        dataLabels: { enabled: true, color: isDarkMode ? "#fff" : "#000" },
        type: "heatmap",
      },
    ],
    credits: { enabled: false },
  };

  return (
    <Card className="col-span-full shadow-md border-0 bg-white dark:bg-gray-800">
      <CardHeader className="flex justify-between lg:flex-row flex-col">
        <CardTitle className="text-base font-semibold">Annual Category Trends (Heatmap)</CardTitle>
        <div>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="bg-gray-100 dark:bg-gray-700 border dark:border-gray-600 text-xs text-gray-800 dark:text-white rounded-md px-2 py-1"
          >
            {years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </CardHeader>
      <CardContent>
        <div className="w-full overflow-x-auto">
          <div className="min-w-[750px]">
            <HighchartsReact highcharts={Highcharts} options={options} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default AnnualCategoryTrendsChart;