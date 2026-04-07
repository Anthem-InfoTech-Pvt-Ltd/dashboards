"use client"

import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts"
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card"
import { useEffect, useState } from "react";
import { useAuth } from "@/context/auth-context";
import { apiService } from "@/lib/apiService";

interface MonthlyRadarChart {
  years: number[];
  selectedGlobalYear: number;
}

export const MonthlyRadarChart: React.FC<MonthlyRadarChart> = ({ years, selectedGlobalYear }) => {
  const [isDarkMode, setIsDarkMode] = useState(false)
  const [selectedYear, setSelectedYear] = useState(selectedGlobalYear || new Date().getFullYear())
  const [chartData, setChartData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true)
  const { user } = useAuth()
  const groupId = user?.groupId

  useEffect(() => {
    setSelectedYear(selectedGlobalYear); // Sync with global year when it changes
  }, [selectedGlobalYear]);

  useEffect(() => {
    const checkDarkMode = () =>
      document.documentElement.classList.contains("dark")

    setIsDarkMode(checkDarkMode())

    const observer = new MutationObserver(() => {
      setIsDarkMode(checkDarkMode())
    })

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"]
    })

    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!groupId) return

    const fetchData = async () => {
      try {
        setLoading(true)

        const data = await apiService.getYearlyExpense(groupId, selectedYear)

        const months = [
          "Jan", "Feb", "Mar", "Apr", "May", "Jun",
          "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
        ]

        const monthlyMap: Record<string, { income: number; expenses: number }> = {}
        months.forEach((m) => {
          monthlyMap[m] = { income: 0, expenses: 0 }
        })

        data.forEach((item) => {
          const monthName = months[parseInt(item.month) - 1]
          monthlyMap[monthName].income += Number(item.totalCredit || 0)
          monthlyMap[monthName].expenses += Number(item.totalDebit || 0)
        })

        const transformedData = months.map((month) => ({
          month,
          income: monthlyMap[month].income,
          expenses: monthlyMap[month].expenses,
        }))

        setChartData(transformedData)
      } catch (err) {
        console.error("Error loading radar chart data:", err)
        setChartData([])
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [selectedYear, groupId])

  const RadarCustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || payload.length === 0) return null;

    const credit = payload.find((p: any) => p.name === "Credit")?.value || 0;
    const debit = payload.find((p: any) => p.name === "Debit")?.value || 0;

    return (
      <div
        style={{
          background: "#fff",
          color: "#111",
          padding: "10px 12px",
          borderRadius: "8px",
          fontSize: "12px",
          minWidth: "120px",
          boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
        }}
      >
        <div style={{ fontWeight: 600, marginBottom: 6 }}>{label}</div>

        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ color: "#60d394" }}>Credit: </span>
          <b>₹{credit.toLocaleString()}</b>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ color: "#ef4444" }}>Debit: </span>
          <b>₹{debit.toLocaleString()}</b>
        </div>
      </div>
    );
  };

  return (
    <Card className="shadow-lg border-0 bg-white dark:bg-gray-800 lg:col-span-4 col-span-1">
      <CardHeader className="pb-2 flex flex-col lg:flex-row justify-between gap-2">
        <div>
          <CardTitle className="flex items-center gap-2 text-gray-800 dark:text-white text-base">
            Monthly Credit vs Debit
          </CardTitle>
        </div>
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

      <CardContent className="h-[450px] p-6">
        {loading ? (
          // 🔹 Loading Selection UI
          <div className="w-full h-full flex flex-col items-center justify-center gap-3">
            <div className="animate-pulse w-64 h-64 rounded-full bg-gray-200 dark:bg-gray-700" />
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart
              cx="50%"
              cy="50%"
              outerRadius="75%"
              data={chartData}
            >
              <PolarGrid strokeDasharray="4 4" />
              <PolarAngleAxis
                dataKey="month"
                tick={{ fill: "#6b7280", fontSize: 12 }}
              />
              <PolarRadiusAxis
                angle={30}
                domain={[0, 11000]}
                tick={{ fill: "#9ca3af", fontSize: 11 }}
              />
              <Tooltip content={<RadarCustomTooltip />} />
              <Legend verticalAlign="bottom" iconType="circle" height={36} />
              <Radar
                name="Credit"
                dataKey="income"
                stroke="#60d394"
                fill="#60d394"
                fillOpacity={0.4}
              />
              <Radar
                name="Debit"
                dataKey="expenses"
                stroke="#ef4444"
                fill="#ef4444"
                fillOpacity={0.4}
              />
            </RadarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}

export default MonthlyRadarChart;