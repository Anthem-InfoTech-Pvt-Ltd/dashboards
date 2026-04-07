"use client";
import React, { useEffect, useRef, useState } from 'react';
import Highcharts from 'highcharts';
import { apiService } from '@/lib/apiService';
import { CardContent, CardHeader, Card, CardTitle } from './ui/card';
import { useAuth } from '@/context/auth-context';

interface StackedBarCategoryChartProps {
  years: number[];
  height?: number;
  currency: string;
}

export const StackedBarCategoryChart: React.FC<StackedBarCategoryChartProps> = ({
  years,
  height = 450,
  currency
}) => {
  const [isDarkMode, setIsDarkMode] = useState(false)
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<Highcharts.Chart | null>(null);
  const { user } = useAuth()
  const groupId = user?.groupId

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
    const fetchDataAndRenderChart = async () => {
      try {
        const { data, categories } = await apiService.getYearlyCategoryExpenses(groupId, years);
        data.sort((a, b) => b.year - a.year); // Sort data by year descending, like in JS
        // Calculate total expense per category across all years (but sort by latest year, like in JS)
        const categoryTotals: { [key: string]: number } = {};
        console.log("data: ", data);
        categories.forEach(category => {
          categoryTotals[category] = 0;
          data.forEach(yearData => {
            const val = yearData[category];
            if (val && val !== 0) {
              categoryTotals[category] += Number(val);
            }
          });
        });
        // Sort categories descending by latest year's expense (like in JS)
        const latestYearIndex = data.length - 1;
        const sortedCategories = categories
          .filter(category => categoryTotals[category] > 0)
          .sort((a, b) => {
            const valA = data[latestYearIndex][a] ? Number(data[latestYearIndex][a]) : 0;
            const valB = data[latestYearIndex][b] ? Number(data[latestYearIndex][b]) : 0;
            return valB - valA;
          });
        // Map to series in sorted order
        const series = sortedCategories.map(category => {
          const values = data.map(yearData => {
            const val = yearData[category];
            return val && val !== 0 ? Number(val) : null;
          });
          return {
            name: category,
            data: values,
          };
        });
        // Year labels as before (but now xAxis will be categories, yAxis values for horizontal)
        const yearLabels = data.map(item => item.year);
        if (chartContainerRef.current) {
          if (chartRef.current) {
            chartRef.current.destroy();
          }
          chartRef.current = Highcharts.chart(chartContainerRef.current, {
            chart: {
              type: 'bar', // Changed to 'bar' for horizontal (row-wise) stacked bars
              height: height,
              backgroundColor: "transparent",
            },
            title: {
              text: undefined,
            },
            xAxis: {
              categories: yearLabels,
              crosshair: true,
            },
            yAxis: {
              min: 0,
              title: {
                text: `Amount (${currency})`,
              },
              labels: {
                formatter: function () {
                  const value = this.value;
                  if (value >= 1000000) return currency + (value / 1000000).toFixed(1) + 'M';
                  if (value >= 1000) return currency + (value / 1000).toFixed(0) + 'k';
                  return currency + Highcharts.numberFormat(value, 0, '.', ',');
                }
              }
            },
            tooltip: {
              shared: true,
              useHTML: true,
              backgroundColor: isDarkMode ? "#111827" : "#ffffff",
              style: {
                color: isDarkMode ? "#f3f4f6" : "#111827",
                padding: "10px",
                fontSize: "13px",
              },
              formatter: function () {
                const year = this.points?.[0]?.key;
                let total = 0;

                let html = `<b>${year}</b><br/>`;

                this.points?.forEach(point => {
                  const value = Number(point.y || 0);
                  total += value;

                  const formattedValue = value.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  });

                  html += `
        <span style="color:${point.color}">●</span>
        ${point.series.name}: 
        <b>${currency}${formattedValue}</b><br/>
      `;
                });

                const totalFormatted = total.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                });

                html += `
      <hr style="
        border:none;
        border-top:1px solid ${isDarkMode ? "#374151" : "#e5e7eb"};
        margin:6px 0;
      "/>
      <b>Total: ${currency}${totalFormatted}</b>
    `;

                return html;
              },
            },
            legend: {
              itemStyle: {
                color: isDarkMode ? "#f3f4f6" : "#111827",
                fontSize: '12px',
              },
              itemHoverStyle: {
                color: isDarkMode ? "#e5e7eb" : "#000000",
              },
            },
            plotOptions: {
              bar: { // Changed from 'column' to 'bar'
                stacking: 'normal',
                minPointLength: 35, // Added like in JS for better visibility
                dataLabels: {
                  enabled: true,
                  formatter: function () {
                    const val = this.y;
                    if (val >= 1000000) return currency + (val / 1000000).toFixed(2) + 'M';
                    if (val >= 1000) return currency + (val / 1000).toFixed(2) + 'k';
                    return currency + Number(val).toLocaleString();
                  },
                  color: isDarkMode ? '#f3f4f6' : '#111827',
                  style: {
                    textOutline: 'none',
                    fontSize: '10px', // Added like in JS
                  },
                },
              },
            },
            series: series,
            credits: {
              enabled: false,
            },
            colors: [ // Updated colors to match JS file
              "#ffc107",
              "#95c623",
              "#20c997",
              "#d00000",
              "#9d4edd",
              "#f77f00",
              "#4c9bfd",
              "#0dcaf0",
              "#ff4d6d",
            ],
          });
        }
      } catch (error) {
        console.error('Error loading chart data:', error);
        if (chartContainerRef.current) {
          chartContainerRef.current.innerHTML = `
        <div class="flex items-center justify-center text-red-500 h-full">
          Failed to load chart data
        </div>
      `;
        }
      }
    };
    fetchDataAndRenderChart();
  }, [groupId, years, height, isDarkMode, currency]); // Added dependencies like in JS

  return (
    <Card className="shadow-lg border-0 bg-white col-span-6 dark:bg-gray-800 lg:col-span-6">
      <CardHeader className="pb-2 flex justify-between flex-col lg:flex-row">
        <div>
          <CardTitle className="text-gray-800 dark:text-white text-base">Yearly Debit by Category</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="">
        <div className="w-full overflow-x-auto">
          <div className="min-w-[700px]">
            <div ref={chartContainerRef} style={{ height: `${height}px` }} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default StackedBarCategoryChart;