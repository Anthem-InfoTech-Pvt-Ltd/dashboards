"use client";

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import { ChartContainer } from "@/components/ui/chart"
import { useEffect, useState } from "react"
import { useAuth } from "@/context/auth-context"
import { ExpenseRecord } from "@/lib/types"
import { apiService } from "@/lib/apiService"

interface DailyExpenseChart {
    years: number[];
    currency: string;
    selectedGlobalYear: number;
}

export const DailyExpenseChart: React.FC<DailyExpenseChart> = ({ years, currency, selectedGlobalYear }) => {
    const [data, setData] = useState<ExpenseRecord[]>([])
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1) // current month
    const [selectedYear, setSelectedYear] = useState(selectedGlobalYear || new Date().getFullYear())
    const [loading, setLoading] = useState(false)
    const { user } = useAuth()
    const groupId = user?.groupId

    const monthsList = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ]

    useEffect(() => {
        setSelectedYear(selectedGlobalYear); // Sync with global year when it changes
    }, [selectedGlobalYear]);

    useEffect(() => {
        if (!groupId) return
        const fetchData = async () => {
            setLoading(true)
            try {
                const data = await apiService.getDailyExpenses(groupId, selectedYear, selectedMonth)
                setData(data);
            } catch (error) {
                console.error('Error fetching daily expenses:', error)
            } finally {
                setLoading(false)
            }
        }

        fetchData()
    }, [groupId, selectedYear, selectedMonth])

    const formatNumber = (value: number) => {
        return Number(value).toLocaleString();
    };

    return (
        <Card className="shadow-lg border-0 bg-white dark:bg-gray-800 col-span-12">
            <CardHeader className="flex justify-between flex-col lg:flex-row">
                <div>
                    <CardTitle className="flex items-center gap-2 text-md font-semibold">Daily Expenses ({monthsList[selectedMonth - 1]} {selectedYear})</CardTitle>
                </div>
                <div className="flex gap-2">
                    <select
                        className="bg-gray-100 dark:bg-gray-700 border dark:border-gray-600 text-xs text-gray-800 dark:text-white rounded-md px-1 py-1"
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(Number(e.target.value))}
                    >
                        {monthsList.map((month, index) => (
                            <option key={month} value={index + 1}>{month}</option>
                        ))}
                    </select>

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
            <CardContent>
                {loading ? (
                    <div className="h-[350px] p-4 animate-pulse">
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
                    <div className="w-full overflow-x-auto">
                        <div className="min-w-[800px]">
                            <ChartContainer
                                config={{
                                    credit: { label: "Credit", color: "#22c55e" },
                                    debit: { label: "Debit", color: "#ef4444" },
                                }}
                                className="h-[350px] w-full"
                            >
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={data} margin={{ top: 20, right: 20, bottom: 50, left: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                                        <XAxis
                                            dataKey="date"
                                            angle={-45}
                                            textAnchor="end"
                                            interval={0}
                                            dy={10}
                                            stroke="#888"
                                        />
                                        <YAxis
                                            stroke="#888"
                                            tickFormatter={formatNumber}
                                        />
                                        <Tooltip
                                            content={({ active, payload }) => {
                                                if (active && payload && payload.length) {
                                                    const d = payload[0].payload
                                                    return (
                                                        <div className="bg-white p-2 border shadow rounded text-sm">
                                                            <p className="font-bold">{d.date}</p>
                                                            <p>Credit: {currency}{formatNumber(d.credit)}</p>
                                                            <p>Debit: {currency}{formatNumber(d.debit)}</p>
                                                        </div>
                                                    )
                                                }
                                                return null
                                            }}
                                        />
                                        <Line type="monotone" dataKey="credit" stroke="#22c55e" strokeWidth={2} dot={false} />
                                        <Line type="monotone" dataKey="debit" stroke="#ef4444" strokeWidth={2} dot={false} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </ChartContainer>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}

export default DailyExpenseChart;