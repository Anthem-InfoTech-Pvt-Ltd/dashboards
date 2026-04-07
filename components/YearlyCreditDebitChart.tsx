"use client";
import Highcharts from "highcharts/highstock";
import HighchartsReact from "highcharts-react-official";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/context/auth-context";
import { apiService } from "@/lib/apiService";

export const YearlyCreditDebitChart = ({
  years,
  currency,
  selectedGlobalYear
}: {
  years: number[];
  currency: string;
  selectedGlobalYear: number;
}) => {
  const { user } = useAuth();
  const groupId = user?.groupId;
  const [selectedYear, setSelectedYear] = useState(selectedGlobalYear || new Date().getFullYear());
  const [data, setData] = useState<{ credit: [number, number][], debit: [number, number][] }>({ credit: [], debit: [] });
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setSelectedYear(selectedGlobalYear); // Sync with global year when it changes
  }, [selectedGlobalYear]);

  // Detect dark mode
  useEffect(() => {
    const checkDarkMode = () =>
      document.documentElement.classList.contains("dark");
    setIsDarkMode(checkDarkMode());
    const observer = new MutationObserver(() => {
      setIsDarkMode(checkDarkMode());
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, []);

  // Fetch data
  useEffect(() => {
    if (!groupId) return;
    const fetchData = async () => {
      try {
        setLoading(true);
        const res = await apiService.getYearlyCreditDebit(groupId, selectedYear);
        setData(res);
      } catch (err) {
        console.error(err);
        setData({ credit: [], debit: [] });
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [selectedYear, groupId]);

  // Determine chart range based on current date and selected year
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth(); // 0-11
  const isCurrentYear = selectedYear === currentYear;
  let minTime: number, maxTime: number;
  if (!isCurrentYear) {
    // SHOW FULL YEAR FOR PAST / FUTURE YEARS
    minTime = new Date(selectedYear, 0, 1).getTime(); // Jan 1
    maxTime = new Date(selectedYear, 11, 31).getTime(); // Dec 31
  } else {
    // CURRENT YEAR LOGIC
    if (currentMonth < 3) {
      // Jan–Mar → current + next 3 months
      minTime = new Date(selectedYear, currentMonth, 1).getTime();
      maxTime = new Date(selectedYear, currentMonth + 4, 0).getTime();
    } else {
      // Apr–Dec → previous 3 + current month
      minTime = new Date(selectedYear, currentMonth - 3, 1).getTime();
      maxTime = new Date(selectedYear, currentMonth + 1, 0).getTime();
    }
  }

  // Filter data to only include points within the range
  const filteredCredit = data.credit.filter(([x]) => x >= minTime && x <= maxTime);
  const filteredDebit = data.debit.filter(([x]) => x >= minTime && x <= maxTime);

  const options: Highcharts.Options = {
    chart: {
      height: 450,
      backgroundColor: "transparent",
      style: {
        color: isDarkMode ? "#f3f4f6" : "#111827",
      },
    },
    title: { text: undefined },
    xAxis: {
      type: "datetime",
      min: minTime,
      max: maxTime,
      endOnTick: false,
      labels: {
        style: {
          color: isDarkMode ? "#d1d5db" : "#374151",
        },
      },
      lineColor: isDarkMode ? "#374151" : "#d1d5db",
      tickColor: isDarkMode ? "#374151" : "#d1d5db",
    },
    yAxis: {
      opposite: false,
      title: { text: `Amount(${currency})` },
      labels: {
        formatter() {
          return `${currency}${Highcharts.numberFormat(this.value as number, 0, '.', ',')}`;
        },
        style: {
          color: isDarkMode ? "#d1d5db" : "#374151",
        },
      },
      gridLineColor: isDarkMode ? "#1f2937" : "#e5e7eb",
    },
    tooltip: {
      shared: true,
      pointFormatter() {
        return `<span style="color:${this.color}">\u25CF</span> <b>
  ${this.series.name}:
  ${currency}${Highcharts.numberFormat(this.y as number, 0, '.', ',')}
</b><br/>
<br/>`;
      },
      backgroundColor: isDarkMode ? "#111827" : "#ffffff",
      borderColor: isDarkMode ? "#374151" : "#d1d5db",
      style: {
        color: isDarkMode ? "#f3f4f6" : "#111827",
        fontSize: "13px",
      },
    },
    plotOptions: {
      series: {
        marker: {
          enabled: true,
          radius: 3,
          states: {
            hover: { radius: 5 },
          },
          // Show marker only if value > 0
          symbol: 'circle',
          fillColor: undefined, // default will be series color
        },
        dataLabels: {
          enabled: false,
        },
      },
      spline: {
        states: {
          hover: {
            lineWidth: 4,
          },
        },
        marker: {
          enabled: true,
          radius: 3,
          symbol: 'circle',
          fillColor: undefined,
        },
      },
    },
    series: [
      {
        name: "Credit",
        data: filteredCredit.map(([x, y]) => ({
          x,
          y,
          marker: { enabled: y > 0 },
        })),
        type: "spline",
        color: "#10B981",
        lineWidth: 2,
      },
      {
        name: "Debit",
        data: filteredDebit.map(([x, y]) => ({
          x,
          y,
          marker: { enabled: y > 0 },
        })),
        type: "spline",
        color: "#EF4444",
        lineWidth: 2,
      },
    ],
    credits: { enabled: false },
    legend: {
      layout: "horizontal",
      align: "center",
      verticalAlign: "bottom",
      itemStyle: {
        color: isDarkMode ? "#f3f4f6" : "#111827",
        fontSize: "13px",
      },
      itemHoverStyle: {
        color: isDarkMode ? "#10B981" : "#10B981", // hover highlight
      },
    },
  };

  return (
    <Card className="shadow-lg border-0 bg-white dark:bg-gray-800">
      <CardHeader className="flex justify-between flex-col lg:flex-row">
        <CardTitle className="text-gray-800 dark:text-white text-base">
          Yearly Credit vs Debit ({selectedYear})
        </CardTitle>
        <div className="flex gap-2 items-center">
          <select
            className="bg-gray-100 dark:bg-gray-700 border dark:border-gray-600 text-xs text-gray-800 dark:text-white rounded-md px-2 py-1"
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
          >
            {years.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          // 🔹 Selection-style loading UI (chart ki jagah)
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
                {[...Array(18)].map((_, i) => (
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
              {[...Array(18)].map((_, i) => (
                <div
                  key={i}
                  className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded"
                />
              ))}
            </div>
          </div>
        ) : (
          <>
            <div className="w-full overflow-x-auto">
              <div className="min-w-[800px]">
                <HighchartsReact
                  highcharts={Highcharts}
                  constructorType="stockChart"
                  options={options}
                />
              </div>
            </div>
            {/* Legend */}
            <div className="flex justify-center gap-4 mt-4 text-sm">
              <div className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-full bg-green-500 inline-block"></span>
                Credit
              </div>
              <div className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-full bg-red-500 inline-block"></span>
                Debit
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};
export default YearlyCreditDebitChart;