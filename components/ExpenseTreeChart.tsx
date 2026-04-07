"use client"

import React, { useEffect, useState, useRef } from "react"
import ReactECharts from "echarts-for-react"
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card"
import { useAuth } from "@/context/auth-context"
import { apiService } from "@/lib/apiService"
import { TreeNode } from "@/lib/types"

interface ExpenseTreeChart {
    years: number[];
    currency: string;
}

export const ExpenseTreeChart: React.FC<ExpenseTreeChart> = ({ years, currency }) => {
    const [treeData, setTreeData] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const chartRef = useRef<any>(null)
    const [isDark, setIsDark] = useState(false)
    const [roamEnabled, setRoamEnabled] = useState(false)
    const { user } = useAuth()
    const groupId = user?.groupId

    // Watch Tailwind's dark mode
    useEffect(() => {
        const observer = new MutationObserver(() => {
            setIsDark(document.documentElement.classList.contains("dark"))
        })
        observer.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ["class"]
        })
        setIsDark(document.documentElement.classList.contains("dark"))
        return () => observer.disconnect()
    }, [])

    useEffect(() => {
        async function fetchData() {
            if (!groupId || years.length === 0) return;
            try {
                const data = await apiService.getTreeGraphData(groupId, years, currency)
                const nested = buildTree(data)
                setTreeData(nested)
            } catch (err) {
                console.error("Failed to load tree data", err)
            } finally {
                setLoading(false)
            }
        }
        fetchData()
    }, [groupId, years])

    function buildTree(flat: TreeNode[], isDark: boolean): any[] {
        const idMap: Record<string, any> = {}
        const roots: any[] = []

        flat.forEach((node) => {
            const parts = node.id.split("-")
            const level = parts.length - 1

            let symbol = "circle"
            let customColor = "#9ca3af"

            if (node.id === "root") {
                symbol = "diamond"
                customColor = isDark ? "#fb8b24" : "#e36414"
            } else if (node.parent === "root") {
                symbol = "rect"
                customColor = isDark ? "#48cae4" : "#0077b6"
            } else if (level === 1) {
                symbol = "circle"
                customColor = isDark ? "#a7c957" : "#6a994e"
            } else {
                symbol = "diamond"
                customColor = isDark ? "#89c2d9" : "#02c39a"
            }

            idMap[node.id] = {
                ...node,
                children: [],
                symbol,
                symbolSize: 14,
                itemStyle: { color: customColor }
            }
        })

        flat.forEach((node) => {
            if (node.parent && idMap[node.parent]) {
                idMap[node.parent].children.push(idMap[node.id])
            } else {
                roots.push(idMap[node.id])
            }
        })

        return roots
    }

    const option = {
        backgroundColor: isDark ? "#1f2937" : "#ffffff",
        tooltip: {
            trigger: "item",
            triggerOn: "mousemove",
            backgroundColor: isDark ? "#374151" : "#f9fafb",
            borderColor: isDark ? "#4b5563" : "#e5e7eb",
            textStyle: { color: isDark ? "#f9fafb" : "#111827" },
            formatter: (params: any) => `<b>${params.data.name}</b>`
        },
        series: [
            {
                type: "tree",
                data: treeData,
                layout: "orthogonal",
                orient: "LR",
                top: "1%",
                left: "15%",
                bottom: "1%",
                right: "20%",
                symbolSize: 14,
                label: {
                    position: "left",
                    verticalAlign: "middle",
                    align: "right",
                    fontSize: 13,
                    color: isDark ? "#f9fafb" : "#111827"
                },
                leaves: {
                    label: {
                        position: "right",
                        verticalAlign: "middle",
                        align: "left",
                        fontSize: 13,
                        color: isDark ? "#f9fafb" : "#111827"
                    }
                },
                lineStyle: { color: isDark ? "#6b7280" : "#d1d5db" },
                expandAndCollapse: true,
                emphasis: {
                    focus: 'descendant'
                },
                initialTreeDepth: 2,
                animationDuration: 350,
                animationDurationUpdate: 350,
                roam: roamEnabled,
                nodePadding: 25
            }
        ]
    }
    const onChartReady = (chart: any) => {
        chartRef.current = chart;

        chart.on("mouseover", function (params: any) {
            const level = params.data.id.split("-").length - 1;
            if (level === 1) {
                chart.dispatchAction({
                    type: "expandTreeNode",
                    seriesIndex: 0,
                    dataIndex: params.dataIndex
                });
            }
        });

        chart.on("mouseout", function (params: any) {
            const level = params.data.id.split("-").length - 1;
            if (level === 1) {
                chart.dispatchAction({
                    type: "collapseTreeNode",
                    seriesIndex: 0,
                    dataIndex: params.dataIndex
                });
            }
        });
    };


    if (loading) {
        return (
            <Card className="shadow-lg border-0 bg-white dark:bg-gray-800 col-span-3">
                <CardHeader className="flex justify-between lg:flex-row flex-col items-center gap-3">
                    <CardTitle className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                        Yearly Credit & Debit Overview
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {/* Skeleton placeholder for chart */}
                    <div className="animate-pulse bg-gray-200 dark:bg-gray-700 rounded-md w-full h-[650px]" />
                </CardContent>
            </Card>
        )
    }

    return (
        <Card className="shadow-lg border-0 bg-white dark:bg-gray-800 col-span-3">
            <CardHeader className="flex justify-between lg:flex-row flex-col gap-3">
                <CardTitle className="text-base font-semibold text-gray-900 dark:text-gray-100">
                    Yearly Credit & Debit Overview
                </CardTitle>

                <div className="flex items-center gap-4">
                    {/* Move chart toggle */}
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                            Move chart
                        </span>
                        <div
                            onClick={() => setRoamEnabled(!roamEnabled)}
                            className={`w-14 h-7 flex items-center rounded-full p-1 cursor-pointer transition-colors duration-300 
                    ${roamEnabled ? "bg-blue-500" : "bg-gray-400"}`}
                        >
                            <div
                                className={`bg-white w-5 h-5 rounded-full shadow-md transform transition-transform duration-300 
                        ${roamEnabled ? "translate-x-7" : "translate-x-0"}`}
                            />
                        </div>
                    </div>

                    {/* View Detailed Map button */}
                    <button
                        onClick={() => window.open("/expenses/detailed-map", "")}
                        className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 transition"
                    >
                        View Detailed Map
                    </button>
                </div>
            </CardHeader>

            <CardContent>
                <div className="w-full overflow-x-auto">
                    <div className="min-w-[800px]">
                        <ReactECharts
                            option={option}
                            style={{ height: "1000px", width: "100%" }}
                            onChartReady={onChartReady}
                        />
                    </div>
                </div>
            </CardContent>
        </Card >
    )
}

export default ExpenseTreeChart;