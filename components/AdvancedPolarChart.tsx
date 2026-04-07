"use client"

import Highcharts from "highcharts";
import HighchartsReact from "highcharts-react-official";
import HighchartsMore from "highcharts/highcharts-more";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { useAuth } from "@/context/auth-context";
import { apiService } from "@/lib/apiService";

if (typeof Highcharts === "function") {
    HighchartsMore(Highcharts);
}

type MonthlyRecord = {
    date: string;
    credit: number;
    debit: number;
};

interface AdvancedPolarChart {
    years: number[];
    selectedGlobalYear: number;
}

const AdvancedPolarChart: React.FC<AdvancedPolarChart> = ({ years, selectedGlobalYear }) => {
    const [isDarkMode, setIsDarkMode] = useState(false)
    const [monthlyData, setMonthlyData] = useState<MonthlyRecord[]>([]);
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)
    const [selectedYear, setSelectedYear] = useState(selectedGlobalYear || new Date().getFullYear())
    const [isLoading, setIsLoading] = useState(true);
    const { user } = useAuth()
    const groupId = user?.groupId
    const darkBg = "#1f1836"
    const lightBg = "#ffffff"

    const darkText = "#ffffff"
    const lightText = "#000000"

    const chartBg = isDarkMode ? darkBg : lightBg
    const textColor = isDarkMode ? darkText : lightText
    const borderColor = isDarkMode ? "#46465C" : "#e0e0e0"
    const secondaryNewBg = isDarkMode ? "rgba(59,130,246,0.1)" : "#eee"

    const colors = (Highcharts.getOptions().colors ?? []).map((c: any) =>
        Highcharts.color(c)
    );

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

    // Effect for fetching data
    useEffect(() => {
        const fetchMonthlyData = async () => {
            if (!groupId) {
                setIsLoading(false);
                return;
            }
            setIsLoading(true);
            try {
                // const res = await fetch(
                //     `/api/monthly-credit-debit?groupId=${groupId}&year=${selectedYear}&month=${selectedMonth}`
                // );
                const data = await apiService.getDailyExpenses(groupId, selectedYear, selectedMonth)
                setMonthlyData(data);
            } catch (err) {
                console.error(err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchMonthlyData();
    }, [groupId, selectedMonth, selectedYear]);

    useEffect(() => {
        if (monthlyData.length === 0) return;

        const maxCredit = Math.max(...monthlyData.map((d) => d.credit || 0)) || 1;
        const maxDebit = Math.max(...monthlyData.map((d) => d.debit || 0)) || 1;

        // Normalize z values (so even large 20k values appear in correct proportion)
        const normalize = (value: number, maxValue: number) => {
            // clamp between 0 and 100 (you can tune this)
            return Math.sqrt(value / maxValue) * 100;
        };

        const creditSeries = monthlyData.map((entry, i) => [
            i + 1,
            1,
            normalize(entry.credit, maxCredit),
        ]);
        const debitSeries = monthlyData.map((entry, i) => [
            i + 1,
            2,
            normalize(entry.debit, maxDebit),
        ]);

        const totalDays = monthlyData.length;
        if (monthlyData.length === 0) return;

        // const creditSeries = monthlyData.map((entry, i) => [i + 1, 1, entry.credit]);
        // const debitSeries = monthlyData.map((entry, i) => [i + 1, 2, entry.debit]);
        // const totalDays = monthlyData.length;

        const scoreData = [
            {
                x: 1,
                low: 0,
                high: 5200,
                avg: 1733,
                highscore: 5000,
                topEarner: 'Credit',
                week: 1
            },
            {
                x: 8,
                low: 0,
                high: 650,
                avg: 216,
                highscore: 500,
                topEarner: 'Credit',
                week: 2
            },
            {
                x: 15,
                low: 0,
                high: 2200,
                avg: 733,
                highscore: 1200,
                topEarner: 'Credit',
                week: 3
            },
            {
                x: 22,
                low: 0,
                high: 2330,
                avg: 777,
                highscore: 2000,
                topEarner: 'Credit',
                week: 4
            }
        ]

        const chartOptions: Highcharts.Options = {
            accessibility: { enabled: false },
            chart: {
                polar: true,
                height: '100%',
                backgroundColor: 'transparent',
                events: {
                    load: function () {
                        const midPane = this.pane[1]
                            ; (this as any).setMidPaneBg = function (background: any) {
                                midPane.update({ background })
                            }
                    }
                }
            },
            title: {
                text: undefined,
                style: {
                    color: textColor,
                    fontSize: '18px'
                }
            },
            subtitle: {
                text: undefined,
                useHTML: true,
                align: 'center',
                y: 35,
                verticalAlign: 'middle',
                style: {
                    fontSize: '1.4em',
                    color: textColor
                }
            },
            pane: [
                {
                    size: '80%',
                    innerSize: '75%',
                    startAngle: 0,
                    endAngle: 360,
                    background: [
                        {
                            borderColor: isDarkMode ? '#444' : '#ccc',
                            backgroundColor: {
                                radialGradient: { cx: 0.5, cy: 0.5, r: 0.5 },
                                stops: [
                                    [0, isDarkMode ? '#1e1e1e' : '#fff'],
                                    [1, isDarkMode ? '#2a2a2a' : '#f4f4f4']
                                ]
                            },
                            innerRadius: '40%'
                        }
                    ]
                },
                {
                    size: '55%',
                    innerSize: '45%',
                    startAngle: 40.5,
                    endAngle: 319.5,
                    background: {
                        borderWidth: 0,
                        backgroundColor: {
                            radialGradient: [1, 0.25, 0.1],
                            stops: [
                                [0, chartBg],
                                [1, borderColor]
                            ]
                        },
                        outerRadius: '75%'
                    }
                },
                {
                    size: '100%',
                    innerSize: '88%',
                    startAngle: 0,
                    endAngle: 360,
                    background: {
                        borderWidth: 1,
                        borderColor: borderColor,
                        backgroundColor: secondaryNewBg,
                        innerRadius: '55%',
                        outerRadius: '100%'
                    }
                }
            ],
            xAxis: [
                {
                    pane: 0,
                    tickInterval: 1,
                    lineWidth: 0,
                    gridLineWidth: 0,
                    min: 1,
                    max: totalDays,
                    labels: { enabled: false },
                },
                {
                    pane: 1,
                    linkedTo: 0,
                    gridLineWidth: 0,
                    lineWidth: 0,
                    plotBands: Array(3).fill(7).map((weekendOffset, week) => {
                        const from = weekendOffset * (week + 1)
                        const to = from - 1
                        return { from, to, color: '#BBBAC5' }
                    }),
                    min: 0,
                    max: totalDays,
                    labels: { enabled: false }
                },
                {
                    pane: 2,
                    tickAmount: 4,
                    tickInterval: 0.5,
                    gridLineWidth: 0,
                    lineWidth: 0,
                    min: 1,
                    max: 5,
                    labels: { enabled: false }
                }
            ],
            yAxis: [
                {
                    pane: 0,
                    gridLineWidth: 0.5,
                    gridLineDashStyle: 'LongDash',
                    gridLineColor: isDarkMode ? '#BBBAC5' : '#7a7a7a',
                    tickInterval: 1,
                    title: undefined,
                    labels: { enabled: false },
                    min: 1,
                    max: 3
                },
                {
                    pane: 1,
                    reversed: true,
                    gridLineWidth: 0,
                    tickInterval: 100,
                    min: 0,
                    max: 400,
                    title: undefined,
                    labels: { enabled: false }
                },
                {
                    pane: 2,
                    tickInterval: 0.25,
                    gridLineWidth: 0,
                    gridLineColor: colors[1].brighten(0.05).toString(),
                    min: -3,
                    max: 1,
                    title: undefined,
                    labels: { enabled: false }
                }
            ],
            legend: {
                enabled: true,
                floating: true,
                layout: 'vertical',
                verticalAlign: 'middle',
                align: 'center',
                backgroundColor: 'transparent',
                borderRadius: 14,
                borderColor: 'transparent',
                borderWidth: 0,
                itemStyle: {
                    color: textColor,
                    fontSize: '0.8em'
                },
                itemHoverStyle: {
                    color: isDarkMode ? '#BBBAC5' : '#333',
                    fontSize: '0.9em'
                }
            },
            tooltip: {
                useHTML: true,
                formatter: function () {
                    const record = monthlyData[this.point.x - 1];
                    const formattedAmount = this.point.z?.toLocaleString("en-IN") ?? 0;

                    // For CREDIT / DEBIT bubbles:
                    if (this.series.type === 'bubble') {
                        return `
        <div style="padding:6px 10px;">
          <div style="font-weight:600; font-size:14px; margin-bottom:4px;">${this.series.name}</div>
          <div><b>Date:</b> ${record?.date || '-'}</div>
          <div><b>Day:</b> ${this.point.x}</div>
          <div><b>Amount:</b> ₹ ${formattedAmount}</div>
        </div>
      `;
                    }

                    // For WEEKLY TOTAL columnrange:
                    // For WEEKLY TOTAL columnrange:
                    if (this.series.type === 'columnrange') {
                        const week = this.point.week || 1;
                        const startIndex = (week - 1) * 7;
                        const endIndex = Math.min(startIndex + 6, monthlyData.length - 1);

                        // Calculate real totals from actual daily data
                        let totalCredit = 0;
                        let totalDebit = 0;

                        for (let i = startIndex; i <= endIndex; i++) {
                            totalCredit += monthlyData[i]?.credit || 0;
                            totalDebit += monthlyData[i]?.debit || 0;
                        }

                        const startDate = monthlyData[startIndex]?.date || "-";
                        const endDate = monthlyData[endIndex]?.date || "-";

                        return `
    <div style="padding:8px 10px; font-size:12px;">
      <div style="font-weight:600; font-size:14px; margin-bottom:6px;">Week ${week}</div>
      <div><b>Start Date:</b> ${startDate}</div>
      <div><b>End Date:</b> ${endDate}</div>
      <div><b>Total Credit:</b> ₹ ${totalCredit.toLocaleString("en-IN")}</div>
      <div><b>Total Debit:</b> ₹ ${totalDebit.toLocaleString("en-IN")}</div>
    </div>
  `;
                    }

                }
            },
            series: [
                // Team series (bubbles)
                {
                    type: 'bubble',
                    name: 'Credit',
                    data: creditSeries,
                    color: colors[9 % colors.length].tweenTo(colors[0], 0.25).toString(),
                    marker: {
                        fillColor: colors[9 % colors.length].tweenTo(colors[0], 0.25).toString(),
                        lineColor: colors[9 % colors.length].tweenTo(colors[0], 0.25).toString(),
                        lineWidth: 2
                    },
                    zMin: 0,           // values start from 0 safely
                    zMax: 100,
                    minSize: "2px",    // not percentage. Always visible.
                    maxSize: "15px",
                    clip: false,
                    tooltip: {
                        headerFormat: '<div class="team-day center">' +
                            '<span class="team-header">' +
                            '<b class="team-index">Day {point.x}</b></span> ' +
                            '<span class="team-name" style="border: 0 outset {series.color};">' +
                            '<b>{series.name}</b></span>',
                        pointFormat: '<span class="team-points">' +
                            '</br>' +
                            '</br><span class="team-salescount-header">Amount:</span>' +
                            '<span class="team-salescount">{point.z}</span>',
                        footerFormat: '</div>',
                        useHTML: true
                    } as any
                },
                {
                    type: 'bubble',
                    name: 'Debit',
                    data: debitSeries,
                    color: colors[9 % colors.length].tweenTo(colors[8 % colors.length], 0.65).toString(),
                    marker: {
                        fillColor: colors[9 % colors.length].tweenTo(colors[8 % colors.length], 0.65).toString(),
                        lineColor: colors[9 % colors.length].tweenTo(colors[8 % colors.length], 0.65).toString(),
                        lineWidth: 2
                    },
                    zMin: 0,           // values start from 0 safely
                    zMax: 100,
                    minSize: "2px",    // not percentage. Always visible.
                    maxSize: "15px",
                    clip: false,
                    tooltip: {
                        headerFormat: '<div class="team-day center">' +
                            '<span class="team-header">' +
                            '<b class="team-index">Day {point.x}</b></span>' +
                            '<span class="team-name" style="border: 0 outset {series.color};">' +
                            '<b>{series.name}</b></span>',
                        pointFormat: '<span class="team-points">' +
                            '</br>' +
                            '</br><span class="team-salescount-header">Amount:</span>' +
                            '<span class="team-salescount">{point.z}</span>',
                        footerFormat: '</div>',
                        useHTML: true
                    } as any
                },
                {
                    type: 'column',
                    name: 'Month',
                    data: Array(4).fill(0).map((_, index) => ({
                        dataLabels: {
                            format: 'Week {x}',
                            enabled: true,
                            inside: true,
                            style: {
                                textOutline: 'none',
                                fontSize: '0.7em',
                                fontWeight: '700',
                                textTransform: 'uppercase'
                            },
                            textPath: {
                                enabled: true,
                                attributes: {
                                    startOffset: index % 3 ? '75%' : index % 2 ? '22%' : '28%',
                                    dx: index % 2 ? '-2%' : '0%',
                                    dy: index % 3 ? '2.8%' : '3.3%'
                                }
                            }
                        },
                        x: index + 1,
                        y: 1.5
                    })),
                    xAxis: 2,
                    yAxis: 2,
                    borderRadius: 50,
                    pointWidth: 1.2,
                    pointPlacement: 'between',
                    enableMouseTracking: false,
                    animation: false,
                    color: isDarkMode ? '#2CAFFE' : '#3A86FF',
                },
                {
                    type: 'columnrange',
                    name: 'Total',
                    data: scoreData,
                    xAxis: 1,
                    yAxis: 1,
                    shadow: false,
                    borderColor: 'transparent',
                    borderWidth: 2,
                    pointPlacement: 'on',
                    pointStart: 1,
                    // tooltip: {
                    //     headerFormat: '<span class="team-day center">' +
                    //         '<span class="large-size">' +
                    //         '<b style="color:{point.color};">Week {point.week}</b></span>',
                    //     pointFormat:
                    //         '<span class="col-display-fieldwrap">' +
                    //         '<span class="symbolSize" style="color:{point.color};">●</span> ' +
                    //         '<b>Credit Total: </b><span>{point.high}</span></span>' +
                    //         '<span class="col-display-fieldwrap">' +
                    //         '<span class="symbolSize" style="color:{point.color};">●</span> ' +
                    //         '<b>Debit Total: </b><span>{point.low}</span></span>' +
                    //         '<span class="col-display-fieldwrap">' +
                    //         '<span class="symbolSize" style="color:{point.color};">●</span> ' +
                    //         '<b>Net Avg: </b><span>{point.avg}</span></span>' +
                    //         '<span class="col-display-fieldwrap">',
                    //     useHTML: true
                    // } as any,
                    animation: false,
                    color: isDarkMode ? '#2CAFFE' : '#3A86FF',
                }
            ]
        }

        Highcharts.chart('polar-container', chartOptions);
    }, [isDarkMode, monthlyData, selectedMonth, selectedYear]);

    return (
        <Card className="shadow-lg border-0 bg-white dark:bg-gray-800 col-span-5">
            <CardHeader className="pb-2 flex justify-between lg:flex-row flex-col">
                <div>
                    <CardTitle className="flex items-center gap-2 text-gray-800 dark:text-white text-base font-semibold">
                        Weekly Credit vs Debit
                    </CardTitle>
                </div>
                <div className="flex gap-2">
                    <select
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(e.target.value)}
                        className="bg-gray-100 dark:bg-gray-700 border dark:border-gray-600 text-xs rounded-md px-1 py-1"
                        disabled={isLoading}
                    >
                        {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                            <option key={m} value={m}>
                                {new Date(0, m - 1).toLocaleString("default", { month: "long" })}
                            </option>
                        ))}
                    </select>
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
            <CardContent className="pt-6 pb-4">
                {isLoading ? (
                    <div className="w-full h-64 flex items-center justify-center">
                        <div className="flex flex-col items-center gap-2">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                            <p className="text-sm text-gray-600 dark:text-gray-400">Loading chart data...</p>
                        </div>
                    </div>
                ) : (
                    <div id="polar-container" className="w-full h-full"></div>
                )}
            </CardContent>
        </Card>
    )
}

export default AdvancedPolarChart