"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useAuth } from "@/context/auth-context";
import { apiService } from "@/lib/apiService";
import MonthlyRadarChart from "./MonthlyRadarChart";
import { DailyExpenseChart } from "./DailyExpenseChart";
import UniqueStatCards from "./UniqueStatCards";
import { FinancialInsight } from "@/lib/types";
import { StackedBarCategoryChart } from "./StackedBarCategoryChart";
import CategoryCumulativeChart from "./CategoryCumulativeChart";

const YearlyCreditDebitChart = dynamic(() => import("./YearlyCreditDebitChart"), { ssr: false });
const AreaYearlyExpenseChart = dynamic(() => import("./AreaYearlyExpenseChart"), { ssr: false });
const CategoryWiseExpenseChart = dynamic(() => import("./CategoryWiseExpenseChart"), { ssr: false });
const HighLevelPieChart = dynamic(() => import("./HighLevelPieChart"), { ssr: false });
const NetBalanceChart = dynamic(() => import("./NetBalanceChart"), { ssr: false });
const AnnualCategoryTrendsChart = dynamic(() => import("./AnnualCategoryTrendsChart"), { ssr: false });
const TreeGraphChart = dynamic(() => import("./ExpenseTreeChart"), { ssr: false });
const AdvancedPolarChart = dynamic(() => import("./AdvancedPolarChart"), { ssr: false });

export default function DashboardContent() {
  const { user } = useAuth();
  const groupId = user?.groupId;
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)
  const [financialInsights, setFinancialInsights] = useState<FinancialInsight | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [years, setYears] = useState<number[]>([]);
  const [currency, setCurrency] = useState<string>("");
  const [selectedGlobalYear, setSelectedGlobalYear] = useState(new Date().getFullYear());
  const [selectedYear, setSelectedYear] = useState(selectedGlobalYear || new Date().getFullYear())

  useEffect(() => {
    setSelectedYear(selectedGlobalYear); // Sync with global year when it changes
  }, [selectedGlobalYear]);

  useEffect(() => {
    if (!groupId) {
      setError("No group ID available. Please sign in.");
      return;
    }

    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        const insights = await apiService.getFinancialInsights(groupId, selectedYear, selectedMonth);
        setFinancialInsights(insights);
      } catch (error: any) {
        console.error("Error fetching financial insights:", error);
        setError(error.message || "Failed to load financial insights. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [groupId, selectedYear, selectedMonth]);

  useEffect(() => {
    const fetchYears = async () => {
      if (!groupId) return;
      const fetchedYears = await apiService.getAvailableYears(groupId);
      setYears(fetchedYears);
      console.log("years: ", years);
      if (fetchedYears.length > 0) setSelectedYear(fetchedYears[fetchedYears.length - 1]);
    };
    const fetchCurrency = async () => {
      if (!groupId) return;
      const fetchedCurrency = await apiService.getCurrency(groupId);
      if (fetchedCurrency.currency == "INR") {
        setCurrency("₹");
      }
      else if (fetchedCurrency.currency == "USD") {
        setCurrency("$");
      }
    };
    fetchYears();
    fetchCurrency();
  }, [groupId]);

  return (
    <div className="space-y-6 max-w-full overflow-hidden">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Expenses Dashboard</h1>
          {/* <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 dark:from-white dark:via-gray-100 dark:to-white bg-clip-text text-transparent">
            Expenses Dashboard
          </h1> */}
          {/* <p className="text-gray-600 dark:text-gray-400 mt-1">Complete overview of your financial data</p> */}
        </div>
        <div className="flex gap-2 items-center">

          <select
            value={selectedGlobalYear}
            onChange={(e) => setSelectedGlobalYear(e.target.value)}
            className="rounded-md px-3 py-2"
            style={{ width: "100px", border: "1px solid #ddd" }}
          >
            {/* <option value="All">All Years</option> */}
            {years.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Comprehensive Dashboard */}
      <div className="space-y-6">
        <UniqueStatCards selectedGlobalYear={selectedGlobalYear} currency={currency} />
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <AreaYearlyExpenseChart years={years} selectedGlobalYear={selectedGlobalYear} currency={currency} />
          <HighLevelPieChart years={years} selectedGlobalYear={selectedGlobalYear} currency={currency} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <NetBalanceChart years={years} selectedGlobalYear={selectedGlobalYear} currency={currency} />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <MonthlyRadarChart years={years} selectedGlobalYear={selectedGlobalYear} currency={currency} />
          <CategoryWiseExpenseChart years={years} selectedGlobalYear={selectedGlobalYear} currency={currency} />
        </div>
        <div className="grid grid-cols-1 gap-6">
          <AnnualCategoryTrendsChart years={years} selectedGlobalYear={selectedGlobalYear} currency={currency} />
        </div>
        <StackedBarCategoryChart years={years} selectedGlobalYear={selectedGlobalYear} currency={currency} />
        <div className="grid grid-cols-1 lg:grid-cols-11 gap-6">
          <CategoryCumulativeChart years={years} selectedGlobalYear={selectedGlobalYear} currency={currency} />
          {/* <AdvancedPolarChart years={years} selectedGlobalYear={selectedGlobalYear} currency={currency} /> */}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
          <YearlyCreditDebitChart years={years} selectedGlobalYear={selectedGlobalYear} currency={currency} />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-1 gap-6">
          <DailyExpenseChart years={years} selectedGlobalYear={selectedGlobalYear} currency={currency} />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-1 gap-6">
          <TreeGraphChart years={years} selectedGlobalYear={selectedGlobalYear} currency={currency} />
        </div>

        {/* Financial Insights */}
        <Card className="shadow-lg border-0 bg-gradient-to-r from-slate-50 to-slate-100 dark:from-gray-800 dark:to-gray-700">
          <CardHeader>
            <CardTitle className="text-gray-900 dark:text-white">Financial Insights & Recommendations</CardTitle>
            <CardDescription className="text-gray-600 dark:text-gray-400">
              Smart insights based on your spending patterns
            </CardDescription>
          </CardHeader>
          <CardContent>
            {financialInsights ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                {/* Highest Debit Month */}
                <div className="p-6 bg-white dark:bg-gray-700 rounded-lg shadow-sm">
                  <h4 className="font-semibold text-emerald-700 dark:text-emerald-400 mb-3">Highest Debit Month</h4>
                  <div className="text-2xl font-bold text-emerald-800 dark:text-emerald-500 mb-2">
                    {financialInsights.highestDebitMonth.month}
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    Highest expenses of {currency}{parseFloat(financialInsights.highestDebitMonth.amount).toFixed(2)}
                  </p>
                </div>

                {/* Lowest Debit Month */}
                <div className="p-6 bg-white dark:bg-gray-700 rounded-lg shadow-sm">
                  <h4 className="font-semibold text-sky-600 dark:text-sky-500 mb-3">Lowest Debit Month</h4>
                  <div className="text-2xl font-bold text-sky-700 dark:text-sky-500 mb-2">
                    {financialInsights.lowestDebitMonth.month}
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    Lowest expenses of {currency}{parseFloat(financialInsights.lowestDebitMonth.amount).toFixed(2)}
                  </p>
                </div>

                {/* Avg Debit */}
                <div className="p-6 bg-white dark:bg-gray-700 rounded-lg shadow-sm">
                  <h4 className="font-semibold text-red-600 mb-3">Avg. Debit</h4>
                  <div className="text-2xl font-bold text-red-600 mb-2">
                    {currency}{parseFloat(financialInsights.avgDebit.amount).toFixed(2)}
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    Across <strong>{financialInsights.avgDebit.transactionCount}</strong> debit transactions this year.
                  </p>
                </div>

                {/* Highest Credit Month */}
                <div className="p-6 bg-white dark:bg-gray-700 rounded-lg shadow-sm">
                  <h4 className="font-semibold text-purple-700 dark:text-purple-600 mb-3">Highest Credit Month</h4>
                  <div className="text-2xl font-bold text-purple-800 dark:text-purple-600 mb-2">
                    {financialInsights.highestCreditMonth.month}
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    Highest credit of {currency}{parseFloat(financialInsights.highestCreditMonth.amount).toFixed(2)}
                  </p>
                </div>

                {/* Lowest Credit Month */}
                <div className="p-6 bg-white dark:bg-gray-700 rounded-lg shadow-sm">
                  <h4 className="font-semibold text-orange-600 dark:text-orange-500 mb-3">Lowest Credit Month</h4>
                  <div className="text-2xl font-bold text-orange-700 dark:text-orange-500 mb-2">
                    {financialInsights.lowestCreditMonth.month}
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    Lowest credit of {currency}{parseFloat(financialInsights.lowestCreditMonth.amount).toFixed(2)}
                  </p>
                </div>

                {/* Avg Credit */}
                <div className="p-6 bg-white dark:bg-gray-700 rounded-lg shadow-sm">
                  <h4 className="font-semibold text-red-500 mb-3">Avg. Credit</h4>
                  <div className="text-2xl font-bold text-red-500 mb-2">
                    {currency}{parseFloat(financialInsights.avgCredit.amount).toFixed(2)}
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    Across <strong>{financialInsights.avgCredit.transactionCount}</strong> credit transactions this year.
                  </p>
                </div>

                {/* This Month’s Trend → UPDATED */}
                <div className="p-6 bg-white dark:bg-gray-700 rounded-lg shadow-sm">
                  <h4 className="font-semibold text-lime-600 dark:text-lime-500 mb-3">This Month’s Trend</h4>
                  <div className="text-2xl font-bold text-lime-700 dark:text-lime-500 mb-2">
                    {financialInsights.thisMonthTrend.trend === "Downward" ? "📉 Downward" : "📈 Upward"}
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    Spending is <strong>
                      {parseFloat(financialInsights.thisMonthTrend.percentageChange).toFixed(2)}%
                      ({currency}{parseFloat(financialInsights.thisMonthTrend.amount).toFixed(2)})
                      {financialInsights.thisMonthTrend.trend.toLowerCase()}
                    </strong> than last month.
                  </p>
                </div>

                {/* Top Spending Category → UPDATED */}
                <div className="p-6 bg-white dark:bg-gray-700 rounded-lg shadow-sm">
                  <h4 className="font-semibold text-orange-700 dark:text-orange-500 mb-3">Top Spending Category</h4>
                  <div className="text-2xl font-bold text-orange-800 dark:text-orange-500 mb-2">
                    {financialInsights.topSpendingCategory.category}
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    Accounts for <strong>
                      {parseFloat(financialInsights.topSpendingCategory.percentage).toFixed(2)}%
                      ({currency}{parseFloat(financialInsights.topSpendingCategory.total).toFixed(2)})
                    </strong> of your total expenses
                  </p>
                </div>

                {/* Income vs Expense → UPDATED */}
                <div className="p-6 bg-white dark:bg-gray-700 rounded-lg shadow-sm">
                  <h4 className="font-semibold text-green-600 dark:text-green-400 mb-3">Credit vs Debit</h4>
                  <div className="text-2xl font-bold text-green-700 dark:text-green-400 mb-2">
                    {financialInsights.incomeVsExpense.ratio}
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    Credits is <strong>
                      {parseFloat(financialInsights.incomeVsExpense.percentageHigher).toFixed(2)}%
                      ({currency}{parseFloat(financialInsights.incomeVsExpense.amountDifference).toFixed(2)})
                      higher
                    </strong> than total debits.
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-gray-600 dark:text-gray-400">No financial insights available.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
