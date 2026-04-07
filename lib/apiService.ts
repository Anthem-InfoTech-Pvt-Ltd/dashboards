import { CategoryData, ExpenseData, ExpenseEntry, ExpenseRecord, FinancialInsight } from "./types";

// Define types for API responses if needed
interface TreeNode {
  id: string;
  parent?: string;
  name: string;
  color?: string;
}

interface HeatmapData {
  categories: string[];
  data: [number, number, number][];
}

interface AttendanceSummaryResponse {
  activeEmployees: Array<{ name: string; experience: string }>;
  dailyReport: { checkedIn: number; notCheckedIn: number };
  previousDayReport: { date: string; checkedIn: number; notCheckedIn: number };
}

interface AttendanceHeatmapResponse {
  days: string[];
  timeSlots: string[];
  data: Array<{
    date: string;
    y: number;
    value: number;
  }>;
}

interface EmployeeMonthlyAttendanceResponse {
  employeeId: number;
  employeeName: string;
  year: number;
  month: number;
  monthName: string;
  attendance: Array<{
    AttendanceDate: string;
    CheckInTime: string | null;
    CheckOutTime: string | null;
    WorkReport: string | null;
    IsLeave: number;
    Reason: string | null;
  }>;
}


export const apiService = {
  // Fetch daily expenses for DailyExpenseChart
  async getDailyExpenses(
    groupId: string,
    year: number,
    month: number
  ): Promise<ExpenseRecord[]> {
    try {
      const res = await fetch(
        `/api/monthly-credit-debit?groupId=${groupId}&year=${year}&month=${month}`,
        { cache: "no-store" }
      );
      if (!res.ok) throw new Error("Failed to fetch daily expenses");
      return await res.json();
    } catch (error) {
      console.error("Error fetching daily expenses:", error);
      return [];
    }
  },

  // Fetch category-wise expenses for HighLevelPieChart and GaugeMultipleKPIChart
  async getExpenseByMonth(
    groupId: string,
    year: number,
    month: number
  ): Promise<CategoryData[]> {
    try {
      const res = await fetch(
        `/api/expense-monthswise?groupId=${groupId}&year=${year}&months=${month}`,
        { cache: "no-store" }
      );
      if (!res.ok) throw new Error("Failed to fetch expense by month");
      return await res.json();
    } catch (error) {
      console.error("Error fetching expense by month:", error);
      return [];
    }
  },

  async getYearlyCreditDebit(groupId: string, year: number): Promise<{ credit: [number, number][], debit: [number, number][] }> {
    try {
      const res = await fetch(`/api/yearly-credit-debit?groupId=${groupId}&year=${year}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to fetch yearly credit debit");
      return await res.json();
    } catch (error) {
      console.error("Error fetching yearly credit debit:", error);
      return { credit: [], debit: [] };
    }
  },

  // Fetch category-wise expenses for HighLevelPieChart and GaugeMultipleKPIChart
  async getCurrency(groupId: string): Promise<{ currency: string }> {
    try {
      const res = await fetch(`/api/currency?groupId=${groupId}`);
      if (!res.ok) throw new Error("Failed to fetch currency");
      return await res.json();
    } catch (error) {
      console.error("Error fetching currency:", error);
      return { currency: "" };
    }
  },

  // Fetch yearly expense data for AreaYearlyExpenseChart and MonthlyRadarChart
  async getYearlyExpense(groupId: string, year: number): Promise<ExpenseData[]> {
    try {
      const res = await fetch(
        `/api/yearly-expense?groupId=${groupId}&year=${year}`,
        { cache: "no-store" }
      );
      if (!res.ok) throw new Error("Failed to fetch yearly expense data");
      return await res.json();
    } catch (error) {
      console.error("Error fetching yearly expense data:", error);
      return [];
    }
  },

  // Fetch category-wise expenses for CategoryWiseExpenseChart
  async getCategoryExpenses(
    groupId: string,
    year: number
  ): Promise<ExpenseEntry[]> {
    try {
      const res = await fetch(
        `/api/category-expenses?groupId=${groupId}&year=${year}`,
        { cache: "no-store" }
      );
      if (!res.ok) throw new Error("Failed to fetch category expenses");
      return await res.json();
    } catch (error) {
      console.error("Error fetching category expenses:", error);
      return [];
    }
  },

  // Fetch heatmap data for AnnualCategoryTrendsChart
  async getAnnualCategoryTrends(
    groupId: string,
    year: number
  ): Promise<HeatmapData> {
    try {
      const res = await fetch(
        `/api/annual-category-trends?groupId=${groupId}&year=${year}`,
        { cache: "no-store" }
      );
      if (!res.ok) throw new Error("Failed to fetch annual category trends");
      return await res.json();
    } catch (error) {
      console.error("Error fetching annual category trends:", error);
      return { categories: [], data: [] };
    }
  },

  // Fetch tree graph data for ExpenseTreeChart
  async getTreeGraphData(groupId: string, years: number[], currency: string): Promise<TreeNode[]> {
    try {
      const yearParams = years.join(",");
      const res = await fetch(`/api/treegraph?groupId=${groupId}&years=${yearParams}&currency=${currency}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Failed to fetch tree graph data");
      return await res.json();
    } catch (error) {
      console.error("Error fetching tree graph data:", error);
      return [];
    }
  },

  // Fetch net balance data for NetBalanceChart
  async getNetBalance(groupId: string, year: number): Promise<[number, number][]> {
    try {
      const res = await fetch(
        `/api/net-balance?groupId=${groupId}&year=${year}`,
        { cache: "no-store" }
      );
      if (!res.ok) throw new Error("Failed to fetch net balance data");
      return await res.json();
    } catch (error) {
      console.error("Error fetching net balance data:", error);
      return [];
    }
  },

  // Fetch stats for UniqueStatCards
  async getYearlyStats(groupId: string, year: number) {
    try {
      const res = await fetch(
        `/api/yearly-expense?groupId=${groupId}&year=${year}`,
        { cache: "no-store" }
      );
      if (!res.ok) throw new Error("Failed to fetch yearly stats");
      return await res.json();
    } catch (error) {
      console.error("Error fetching yearly stats:", error);
      return [];
    }
  },

  // Fetch financial insights data
  async getFinancialInsights(
    groupId: string,
    year: number,
    month: number
  ): Promise<FinancialInsight> {
    try {
      const res = await fetch(
        `/api/financial-insights?groupId=${groupId}&year=${year}&month=${month}`,
        { cache: "no-store" }
      );
      if (!res.ok) throw new Error("Failed to fetch financial insights");
      return await res.json();
    } catch (error) {
      console.error("Error fetching financial insights:", error);
      return {
        highestDebitMonth: { month: "N/A", amount: 0 },
        lowestDebitMonth: { month: "N/A", amount: 0 },
        highestCreditMonth: { month: "N/A", amount: 0 },
        lowestCreditMonth: { month: "N/A", amount: 0 },
        avgDebit: { amount: 0, transactionCount: 0 },
        avgCredit: { amount: 0, transactionCount: 0 },
        thisMonthTrend: { trend: "N/A", percentageChange: 0 },
        topSpendingCategory: { category: "N/A", percentage: 0 },
        incomeVsExpense: { ratio: "N/A", percentageHigher: 0 },
      };
    }
  },

async getYearlyCategoryExpenses(
  groupId: string,
  years: number[]
): Promise<{
  years: string[];
  categories: string[];
  data: { year: string; [category: string]: number }[];
}> {
  try {
    if (!groupId || !years || years.length === 0) {
      return { years: [], categories: [], data: [] };
    }

    const res = await fetch(
      `/api/yearly-category-expenses?groupId=${groupId}&years=${years.join(',')}`,
      { cache: "no-store" }
    );

    if (!res.ok) throw new Error("Failed to fetch yearly category expenses");

    return await res.json();
  } catch (error) {
    console.error("Error fetching yearly category expenses:", error);
    return { years: [], categories: [], data: [] };
  }
},

  // Fetch available years dynamically from backend
  async getAvailableYears(groupId: string): Promise<number[]> {
    try {
      const res = await fetch(`/api/available-years?groupId=${groupId}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to fetch available years");
      const data = await res.json();
      return data.years ?? [];
    } catch (error) {
      console.error("Error fetching available years:", error);
      return [];
    }
  },

  // Fetch available years dynamically from backend
  async getAvailableEmployeeYears(token: string): Promise<number[]> {
    try {
      const res = await fetch(
        `https://managementapinodejs.anthemwork.com/api/employee/available-years?token=${encodeURIComponent(token)}`,
        { cache: "no-store" }
      );
      if (!res.ok) throw new Error("Failed to fetch available years");
      const data = await res.json();
      const availableYears = data.availableYears ?? [];
      // Sort in descending order (newest year first)
      const sortedYears = [...availableYears].sort((a, b) => b - a);
      return sortedYears;
    } catch (error) {
      console.error("Error fetching available years:", error);
      return [];
    }
  },

  /* -------------------- ATTENDANCE SUMMARY -------------------- */
  async getAttendanceSummary(token: string): Promise<AttendanceSummaryResponse | null> {
    try {
      const res = await fetch(
        `https://managementapinodejs.anthemwork.com/api/dashboard-charts/attendance-summary?token=${encodeURIComponent(token)}`,
        { cache: "no-store" }
      );
      if (!res.ok) throw new Error("Failed to fetch attendance summary");
      return await res.json();
    } catch (error) {
      console.error("Attendance summary error:", error);
      return null;
    }
  },

  /* -------------------- ATTENDANCE HEATMAP -------------------- */
  async getAttendanceHeatmap(
    token: string,
    year: number,
    month: number
  ): Promise<AttendanceHeatmapResponse | null> {
    try {
      const res = await fetch(
        `https://managementapinodejs.anthemwork.com/api/dashboard-charts/attendance-heatmap?year=${year}&month=${month}&token=${encodeURIComponent(token)}`,
        { cache: "no-store" }
      );
      if (!res.ok) throw new Error("Failed to fetch attendance heatmap");
      return await res.json();
    } catch (error) {
      console.error("Attendance heatmap error:", error);
      return null;
    }
  },

  /* -------------------- EMPLOYEE TREE -------------------- */
async getEmployeeTree(token: string) {
  try {
    const res = await fetch(
      `https://managementapinodejs.anthemwork.com/api/dashboard-charts/employee-tree?token=${encodeURIComponent(token)}`,
      { cache: "no-store" }
    );
    if (!res.ok) throw new Error("Failed to fetch employee tree");
    return await res.json();
  } catch (error) {
    console.error("Employee tree error:", error);
    return null;
  }
},

/* -------------------- LEAVES REPORT -------------------- */
async getEmployeeLeaves(year: number, token: string) {
  try {
    const res = await fetch(
      `https://managementapinodejs.anthemwork.com/api/dashboard-charts/leaves-report/${year}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      }
    );
    if (!res.ok) throw new Error("Failed to fetch leaves report");
    return await res.json();
  } catch (error) {
    console.error("Leaves report error:", error);
    return null;
  }
},

/* -------------------- EMPLOYEE SALARY -------------------- */
async getEmployeeSalaries(token: string) {
  try {
    const res = await fetch(
      `https://managementapinodejs.anthemwork.com/api/employees-dashboard-charts/salaries`,
      {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      }
    );
    if (!res.ok) throw new Error("Failed to fetch salaries");
    return await res.json();
  } catch (error) {
    console.error("Salary fetch error:", error);
    return null;
  }
},

/* -------------------- JOINED / RESIGNED -------------------- */
async getEmployeeMonthlySummary(token: string, year: number) {
  try {
    const res = await fetch(
      `https://managementapinodejs.anthemwork.com/api/dashboard-charts/employees-monthly-summary?year=${year}&token=${encodeURIComponent(token)}`,
      { cache: "no-store" }
    );
    if (!res.ok) throw new Error("Failed to fetch employee monthly summary");
    return await res.json();
  } catch (error) {
    console.error("Employee monthly summary error:", error);
    return null;
  }
},

/* -------------------- GENDER STATS -------------------- */
async getGenderStats(
  year: number,
  month: number,
  token: string
) {
  try {
    const res = await fetch(
      `https://managementapinodejs.anthemwork.com/api/dashboard-charts/gender-stats?year=${year}&month=${month}&token=${encodeURIComponent(token)}`,
      { cache: "no-store" }
    );
    if (!res.ok) throw new Error("Failed to fetch gender stats");
    return await res.json();
  } catch (err) {
    console.error("Gender stats error:", err);
    return null;
  }
},

/* -------------------- LATE COMING -------------------- */
async getLateEmployees(
  year: number,
  month: number,
  token: string
) {
  try {
    const res = await fetch(
      `https://managementapinodejs.anthemwork.com/api/attendance/late?year=${year}&month=${month}&token=${encodeURIComponent(token)}`,
      { cache: "no-store" }
    );
    if (!res.ok) throw new Error("Failed to fetch late employees");
    return await res.json();
  } catch (err) {
    console.error("Late coming error:", err);
    return null;
  }
},

/* -------------------- LATE COMING -------------------- */
async getYealyLateEmployees(
  year: number,
  month: number,
  token: string
) {
  try {
    const res = await fetch(
      `https://managementapinodejs.anthemwork.com/api/attendance/employee-yearly-late-summary?year=${year}&token=${encodeURIComponent(token)}`,
      { cache: "no-store" }
    );
    if (!res.ok) throw new Error("Failed to fetch late employees");
    return await res.json();
  } catch (err) {
    console.error("Late coming error:", err);
    return null;
  }
},

/* -------------------- LEAVE REPORT -------------------- */
async getLeaveReport(
  year: number,
  token: string
) {
  try {
    const res = await fetch(
      `https://managementapinodejs.anthemwork.com/api/leave-report/${year}?token=${encodeURIComponent(token)}`,
      { cache: "no-store" }
    );
    if (!res.ok) throw new Error("Failed to fetch leave report");
    return await res.json();
  } catch (err) {
    console.error("Leave report error:", err);
    return null;
  }
},

/* -------------------- PROJECT SHOWCASE -------------------- */
async getProjectChart(token: string) {
  try {
    const res = await fetch(
      `https://managementapinodejs.anthemwork.com/api/projects/chart?token=${encodeURIComponent(token)}`,
      { cache: "no-store" }
    );
    if (!res.ok) throw new Error("Failed to fetch project chart");
    return await res.json();
  } catch (err) {
    console.error("Project chart error:", err);
    return null;
  }
},

/* -------------------- EVENTS CALENDAR -------------------- */
async getEventsCalendar(
  year: number,
  token: string
) {
  try {
    const res = await fetch(
      `https://managementapinodejs.anthemwork.com/api/dashboard-charts/events-calendar?year=${year}&token=${encodeURIComponent(token)}`,
      { cache: "no-store" }
    );
    if (!res.ok) throw new Error("Failed to fetch events calendar");
    return await res.json();
  } catch (err) {
    console.error("Events calendar error:", err);
    return null;
  }
},

/* -------------------- EMPLOYEE STATS CARDS -------------------- */
async getEmployeeStats(token: string) {
  try {
    const res = await fetch(
      `https://managementapinodejs.anthemwork.com/api/employee-stats?token=${encodeURIComponent(token)}`,
      { cache: "no-store" }
    );
    if (!res.ok) throw new Error("Failed to fetch employee stats");
    return await res.json();
  } catch (err) {
    console.error("Employee stats error:", err);
    return null;
  }
},

/* -------------------- EMPLOYEE MONTHLY ATTENDANCE -------------------- */
async getEmployeeMonthlyAttendance(
  token: string,
  params: {
    employeeId: number;
    year: number;
    month: number;
  }
): Promise<EmployeeMonthlyAttendanceResponse | null> {
  try {
    const { employeeId, year, month } = params;

    const res = await fetch(
      `https://managementapinodejs.anthemwork.com/api/employee-monthly?employeeId=${employeeId}&year=${year}&month=${month}&token=${encodeURIComponent(token)}`,
      { cache: "no-store" }
    );

    if (!res.ok) throw new Error("Failed to fetch employee monthly attendance");

    return await res.json();
  } catch (error) {
    console.error("Employee monthly attendance error:", error);
    return null;
  }
},

};