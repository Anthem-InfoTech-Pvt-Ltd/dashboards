"use client";

import React, { useEffect, useState } from "react";
import * as echarts from "echarts";
import { apiService } from "@/lib/apiService";
import { useAuth } from "@/context/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

interface CategoryCumulativeChartProps {
    years: number[];
    selectedGlobalYear: number;
}

const monthLabels = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

export default function CategoryCumulativeChart({ years, selectedGlobalYear }: CategoryCumulativeChartProps) {
    const [selectedYear, setSelectedYear] = useState<number>(selectedGlobalYear || new Date().getFullYear());
    const [chartData, setChartData] = useState<{ [key: string]: number[] }>({});
    const [loading, setLoading] = useState(true);

    const { user } = useAuth();
    const groupId = user?.groupId;

    useEffect(() => {
        setSelectedYear(selectedGlobalYear); // Sync with global year when it changes
    }, [selectedGlobalYear]);

    const currentMonthIndex =
        selectedYear === new Date().getFullYear()
            ? new Date().getMonth() // 0-based
            : 11; // past year → full year allowed

    const formatNumber = (value: number) =>
        value.toLocaleString("en-IN"); // 1,000 | 10,000 | 1,00,000

    // Fetch data
    useEffect(() => {
        const fetchData = async () => {
            if (!groupId) {
                setLoading(false);
                setChartData({});
                return;
            }

            setLoading(true);
            try {
                const data: any[] = await apiService.getCategoryExpenses(groupId, selectedYear);

                // Extract unique categories
                const categories = [
                    ...new Set(
                        data.map((d: any) => d.expenseDescType.trim()).filter((v: string) => v !== "")
                    ),
                ];

                const cumulative: { [key: string]: number[] } = {};

                categories.forEach((cat: string) => {
                    const monthly: number[] = new Array(12).fill(0);

                    let runningTotal = 0;

                    for (let m = 1; m <= 12; m++) {
                        // 🚫 Future months (for current year)
                        if (m - 1 > currentMonthIndex) {
                            monthly[m - 1] = null;
                            continue;
                        }

                        const entries = data.filter(
                            (d) => d.expenseDescType.trim() === cat && parseInt(d.month) === m
                        );

                        const monthTotal = entries.reduce(
                            (sum, e) => sum + e.totalExpenses,
                            0
                        );

                        runningTotal += monthTotal;
                        monthly[m - 1] = runningTotal;
                    }

                    cumulative[cat] = monthly;
                });

                setChartData(cumulative);
            } catch (err) {
                console.error("Error fetching cumulative chart:", err);
                setChartData({});
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [groupId, selectedYear]);

    // Render ECharts
    useEffect(() => {
        const chartDom = document.getElementById("cum-chart");
        if (!chartDom || Object.keys(chartData).length === 0 || loading) return;

        const chart = echarts.init(chartDom);

        const series = Object.keys(chartData).map((cat: string) => {
            const data = chartData[cat];

            return {
                name: cat,
                type: "line" as const,
                smooth: true,
                symbol: "circle",
                symbolSize: 6,
                lineStyle: {
                    width: 1.5,
                },
                data,

                // ⭐ END LABEL LIKE YOUR IMAGE
                labelLayout: {
                    moveOverlap: "shiftY"
                },
                endLabel: {
                    show: true,
                    formatter: (params: any) =>
                        `{bg|${params.seriesName} (${formatNumber(params.value)})}`,
                    rich: {
                        bg: {
                            backgroundColor: "#fff",
                            padding: [4, 8],
                            borderRadius: 4,
                            color: "#000",
                            fontSize: 10,
                        },
                    },
                },
                emphasis: {
                    focus: "series"
                },
            };
        });

        const option = {
            backgroundColor: "transparent",

            title: {
                // text: "Category-wise Monthly Expense Trend",
                text: undefined,
                left: "center",
                textStyle: {
                    color: "#222",
                    fontSize: 20,
                    fontWeight: "bold",
                },
            },

            legend: {
                show: true,
                bottom: 0,
                type: "scroll",
                textStyle: { color: "#333" },
            },

            tooltip: {
                trigger: "axis",
                backgroundColor: "rgba(255,255,255,0.95)",
                borderColor: "#ddd",
                borderWidth: 1,
                textStyle: { color: "#000" },
            },

            grid: {
                left: "3%",
                right: "10%",
                bottom: "12%",
                top: "5%",
                containLabel: true,
            },

            xAxis: {
                type: "category" as const,
                data: monthLabels,
                axisLine: { lineStyle: { color: "#aaa" } },
                axisLabel: { color: "#444" },
            },

            yAxis: {
                type: "value" as const,
                axisLine: { show: false },
                axisLabel: { color: "#444" },
                splitLine: {
                    lineStyle: {
                        color: "#eee",
                        type: "solid",
                    },
                },
            },

            color: [
                "#ffc107",
                "#51291e",
                "#95c623",
                "#6610f2",
                "#ff758f",
                "#20c997",
                "#9d4edd",
                "#f77f00",
                "#ff4d6d",
                "#4c9bfd",
                "#0dcaf0",
            ],

            series,

            animationDuration: 10000,
        };

        chart.setOption(option);

        const resizeHandler = () => chart.resize();
        window.addEventListener("resize", resizeHandler);

        return () => {
            window.removeEventListener("resize", resizeHandler);
            chart.dispose();
        };
    }, [chartData, loading]);

    return (
        <Card className="shadow-lg border-0 bg-white col-span-6 dark:bg-gray-800 lg:col-span-6">
            <CardHeader className="pb-2 flex justify-between flex-col lg:flex-row">
                <div>
                    <CardTitle className="text-gray-800 dark:text-white text-base"> Category Expense Trend</CardTitle>
                </div>
                <div>
                    <select
                        className="bg-gray-100 dark:bg-gray-700 border dark:border-gray-600 text-xs text-gray-800 dark:text-white rounded-md px-2 py-1"
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(Number(e.target.value))}
                    >
                        {years.map((year) => (
                            <option key={year} value={year}>{year}</option>
                        ))}
                    </select>
                </div>
            </CardHeader>
            <CardContent className="">
                {loading ? (
                    <div className="h-[400px] flex items-center justify-center text-gray-500 dark:text-gray-400">
                        Loading...
                    </div>
                ) : Object.keys(chartData).length === 0 ? (
                    <div className="h-[400px] flex items-center justify-center text-gray-500 dark:text-gray-400">
                        No data available for selected year.
                    </div>
                ) : (
                    <div className="w-full overflow-x-auto">
                        <div className="min-w-[750px]">
                            <div id="cum-chart" style={{ width: "100%", height: "500px" }}></div>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}