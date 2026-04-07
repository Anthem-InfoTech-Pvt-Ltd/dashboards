"use client"
import { useEffect, useMemo, useState } from "react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Plus, Search, Filter, Download } from "lucide-react"
import { Expense } from "@/lib/types"
import CustomPagination from "@/components/CustomPagination"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import { useAuth } from "@/context/auth-context"
export default function ExpensesPage() {
  const { user } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const [expenseTypes, setExpenseTypes] = useState<{ ExpenseTypeId: number; Type: string }[]>([])
  const [selectedType, setSelectedType] = useState<string>("all")
  const [categories, setCategories] = useState<string[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string>("all")
  const [years, setYears] = useState<number[]>([])
  const [selectedYear, setSelectedYear] = useState<string>("all")
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false);
  const [newExpense, setNewExpense] = useState({
    Description: "",
    Expenses: 0,
    ExpenseTypeId: 0,
    Date: new Date().toISOString(),
    UserId: 0, // will be updated by useEffect
    ExpenseDescType: "",
    GroupId: 0, // will be updated by useEffect
  });

  const [showFilterModal, setShowFilterModal] = useState(false)

  useEffect(() => {
    const fetchExpenses = async () => {
      try {
        setLoading(true)
        const res = await fetch("/api/expenses")
        if (!res.ok) throw new Error("Failed to fetch expenses")
        const data = await res.json()
        setExpenses(data)
        // Extract unique categories
        const uniqueCategories = [...new Set(data.map((exp: Expense) => exp.ExpenseDescType))]
        setCategories(uniqueCategories.filter(Boolean))
      } catch (error) {
        console.error("Error fetching expenses:", error)
      } finally {
        setLoading(false)
      }
    }
    fetchExpenses()
  }, [])

  useEffect(() => {
    const fetchExpenseTypes = async () => {
      try {
        const res = await fetch("/api/expense-types")
        if (!res.ok) throw new Error("Failed to fetch expense types")
        const data = await res.json()
        setExpenseTypes(data)
      } catch (error) {
        console.error("Error fetching expense types:", error)
      }
    }
    fetchExpenseTypes()
  }, [])

  useEffect(() => {
    const fetchYears = async () => {
      if (!user?.groupId) return;
      try {
        const res = await fetch(`/api/available-years?groupId=${user.groupId}`)
        if (!res.ok) throw new Error("Failed to fetch years")
        const data = await res.json()
        setYears(data.years || [])
      } catch (error) {
        console.error("Error fetching years:", error)
      }
    }
    fetchYears()
  }, [user])

  const enrichedExpenses = useMemo(() => {
    const typeMap = Object.fromEntries(
      expenseTypes.map((t) => [t.ExpenseTypeId, t.Type])
    )
    return expenses.map((exp) => ({
      ...exp,
      Type: typeMap[exp.ExpenseTypeId] || "",
    }))
  }, [expenses, expenseTypes])

  const filteredExpenses = useMemo(() => {
    return enrichedExpenses.filter((exp) => {
      const typeMatch = selectedType === "all" || exp.Type === selectedType;
      const categoryMatch =
        selectedCategory === "all" || exp.ExpenseDescType === selectedCategory;
      const yearMatch = selectedYear === "all" || new Date(exp.Date).getFullYear().toString() === selectedYear;
      return typeMatch && categoryMatch && yearMatch;
    });
  }, [enrichedExpenses, selectedType, selectedCategory, selectedYear])

  const paginatedExpenses = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage
    const end = start + rowsPerPage
    return filteredExpenses.slice(start, end)
  }, [filteredExpenses, currentPage, rowsPerPage])

  const handleExportToPDF = () => {
    const doc = new jsPDF()
    doc.setFontSize(16)
    doc.text("Expenses Report", 14, 22)
    const tableColumn = ["Date", "Description", "Category", "Type", "Amount"]
    const tableRows: any[] = []
    filteredExpenses.forEach((exp) => {
      const date = new Date(exp.Date).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
      tableRows.push([
        date,
        exp.Description,
        exp.ExpenseDescType,
        exp.Type === "Cr." ? "Credit" : "Debit",
        `${exp.Expenses.toLocaleString()}`,
      ])
    })
    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 30,
      styles: {
        fontSize: 9,
      },
      columnStyles: {
        0: { cellWidth: 28 },
        1: { cellWidth: 88 },
        2: { cellWidth: 28 },
        3: { cellWidth: 25 },
        4: { cellWidth: 35 },
      },
    })
    doc.save("expenses-report.pdf")
  }

  // Updated handleAddExpense
  const handleAddExpense = async (expenseData: typeof newExpense) => {
    try {
      // Map frontend fields to lowercase for backend
      const payload = {
        description: expenseData.Description,
        expenses: expenseData.Expenses,
        expenseTypeId: expenseData.ExpenseTypeId,
        date: expenseData.Date,
        userId: expenseData.UserId,
        expenseDescType: expenseData.ExpenseDescType || null,
        groupId: expenseData.GroupId, // optional if backend uses it
      };
      const res = await fetch("/api/expenses/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add expense");
      alert("Expense added with ID: " + data.ExpenseId);
    } catch (err) {
      console.error(err);
      alert("Error adding expense: " + (err as Error).message);
    }
  };

  useEffect(() => {
    if (user) {
      setNewExpense((prev) => ({
        ...prev,
        UserId: user.userId,
        GroupId: user.groupId,
      }));
    }
  }, [user]);

  const handleSendEmailReport = async () => {
    try {
      const res = await fetch("/api/expenses/send-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expenses: filteredExpenses,
          email: user?.email,
          fullName: user?.fullName
        })

      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "Failed to send email");
        return;
      }

      alert("Expense report emailed successfully!");
    } catch (error) {
      console.error(error);
      alert("Error sending email");
    }
  };



  return (
    <>
      <div className="space-y-4">
        {/* <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
              Expenses
            </h1>
          </div>


        </div> */}

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div>
                <Label htmlFor="category">Category</Label>
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger>
                    <SelectValue placeholder="All categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All categories</SelectItem>
                    {categories.map((category) => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="type">Type</Label>
                <Select value={selectedType} onValueChange={setSelectedType}>
                  <SelectTrigger>
                    <SelectValue placeholder="All types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All types</SelectItem>
                    <SelectItem value="Cr.">Credit</SelectItem>
                    <SelectItem value="Dr.">Debit</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="year">Year</Label>
                <Select value={selectedYear} onValueChange={setSelectedYear}>
                  <SelectTrigger>
                    <SelectValue placeholder="All years" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All years</SelectItem>
                    {years.map((year) => (
                      <SelectItem key={year} value={year.toString()}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-2 flex items-end gap-2">
                <Button variant="outline" onClick={handleExportToPDF}>
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
                <Button variant="outline" onClick={handleSendEmailReport}>
                  <Download className="h-4 w-4 mr-2" />
                  Email Report
                </Button>

              </div>
            </div>
          </CardContent>
        </Card>
        {/* Expenses Table */}
        <Card>
          <div className="flex justify-between px-6 pt-6 pb-4">
            <div className="text-xl font-semibold">Expenses</div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleExportToPDF}>
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowFilterModal(true)}
              >
                <Filter className="h-4 w-4 mr-2" />
                Filters
              </Button>


              {/* <Button variant="outline" onClick={handleSendEmailReport}>
              <Download className="h-4 w-4 mr-2" />
              Email Report
            </Button> */}

              <Button
                className="bg-blue-600 hover:bg-blue-700 text-white"
                onClick={() => setShowAddModal(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Expense
              </Button>
            </div>
          </div>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 text-sm">Date</th>
                    <th className="text-left py-3 px-4 text-sm">Description</th>
                    <th className="text-left py-3 px-4 text-sm">Category</th>
                    <th className="text-left py-3 px-4 text-sm">Type</th>
                    <th className="text-right py-3 px-4 text-sm">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    Array.from({ length: rowsPerPage }).map((_, i) => (
                      <tr key={i} className="animate-pulse border-b">
                        <td className="py-3 px-4"><div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24" /></td>
                        <td className="py-3 px-4"><div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-32" /></td>
                        <td className="py-3 px-4"><div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24" /></td>
                        <td className="py-3 px-4"><div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-20" /></td>
                        <td className="py-3 px-4 text-right"><div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-16 ml-auto" /></td>
                      </tr>
                    ))
                  ) : (
                    paginatedExpenses.map((expense) => (
                      <tr
                        key={expense.ExpenseId}
                        className="border-b hover:bg-gray-50 dark:hover:bg-gray-800"
                      >
                        <td className="py-3 px-4 text-sm">
                          {new Date(expense.Date).toLocaleDateString("en-GB", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          }).replace(" ", " ")}
                        </td>
                        <td className="py-3 px-4 text-sm">
                          {expense.Description}
                        </td>
                        <td className="py-3 px-4 text-sm">{expense.ExpenseDescType}</td>
                        <td className="py-3 px-4">
                          <Badge variant={expense.Type === "Cr." ? "default" : "destructive"}>
                            {expense.Type === "Cr." ? "Credit" : "Debit"}
                          </Badge>
                        </td>
                        <td
                          className={`py-3 px-4 text-right text-sm ${expense.Type === "Cr." ? "text-green-600 dark:text-green-500" : "text-red-600 dark:text-red-500"
                            }`}
                        >
                          {expense.Type === "Cr." ? "+" : "-"}₹
                          {expense.Expenses.toLocaleString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              <CustomPagination
                totalItems={filteredExpenses.length}
                rowsPerPage={rowsPerPage}
                setRowsPerPage={setRowsPerPage}
                currentPage={currentPage}
                setCurrentPage={setCurrentPage}
              />
            </div>
          </CardContent>
        </Card>
        {showAddModal && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-900 p-6 rounded-xl w-full max-w-lg shadow-xl border border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                Add New Expense
              </h2>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  await handleAddExpense(newExpense);
                  setShowAddModal(false);
                  setLoading(true);
                  const res = await fetch("/api/expenses");
                  const data = await res.json();
                  setExpenses(data);
                  setLoading(false);
                }}
                className="grid grid-cols-1 gap-4"
              >
                {/* Description */}
                <div>
                  <Label htmlFor="description" className="mb-1 block">Description</Label>
                  <input
                    id="description"
                    type="text"
                    placeholder="Enter expense description"
                    value={newExpense.Description}
                    onChange={(e) =>
                      setNewExpense({ ...newExpense, Description: e.target.value })
                    }
                    className="w-full px-3 py-2 border rounded-lg bg-gray-50 dark:bg-gray-800 dark:border-gray-700
              focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                {/* Amount */}
                <div>
                  <Label htmlFor="amount" className="mb-1 block">Amount</Label>
                  <input
                    id="amount"
                    type="number"
                    placeholder="Enter amount"
                    value={newExpense.Expenses}
                    onChange={(e) =>
                      setNewExpense({ ...newExpense, Expenses: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 border rounded-lg bg-gray-50 dark:bg-gray-800 dark:border-gray-700
              focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                {/* Category */}
                <div>
                  <Label htmlFor="category" className="mb-1 block">Category</Label>
                  <select
                    id="category"
                    value={newExpense.ExpenseDescType}
                    onChange={(e) => {
                      const selectedCategory = e.target.value;
                      let autoTypeId = 2; // default: Debit
                      const creditCategories = ["salary", "income", "refund", "deposit"];
                      if (creditCategories.includes(selectedCategory.toLowerCase())) {
                        autoTypeId = 1; // Credit
                      }
                      setNewExpense({
                        ...newExpense,
                        ExpenseDescType: selectedCategory,
                        ExpenseTypeId: autoTypeId,
                      });
                    }}
                    className="w-full px-3 py-2 border rounded-lg bg-gray-50 dark:bg-gray-800 dark:border-gray-700
              focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select Category</option>
                    {categories
                      .slice()
                      .sort((a, b) => a.localeCompare(b))
                      .map((category) => (
                        <option key={category} value={category}>
                          {category}
                        </option>
                      ))}
                  </select>
                </div>
                {/* Expense Type - Auto Filled and Disabled */}
                <div>
                  <Label htmlFor="expenseType" className="mb-1 block">Expense Type</Label>
                  <select
                    id="expenseType"
                    disabled
                    value={newExpense.ExpenseTypeId}
                    className="w-full px-3 py-2 border rounded-lg bg-gray-100 text-gray-500
              dark:bg-gray-800 dark:border-gray-700 cursor-not-allowed"
                  >
                    <option value={0}>Select Expense Type</option>
                    {expenseTypes.map((expenseType) => (
                      <option
                        key={expenseType.ExpenseTypeId}
                        value={expenseType.ExpenseTypeId}
                      >
                        {expenseType.Type === "Cr." ? "Credit" : "Debit"}
                      </option>
                    ))}
                  </select>
                </div>
                {/* Date */}
                <div>
                  <Label htmlFor="date" className="mb-1 block">Date</Label>
                  <input
                    id="date"
                    type="date"
                    max={new Date().toISOString().split("T")[0]}
                    value={newExpense.Date.split("T")[0]}
                    onChange={(e) =>
                      setNewExpense({ ...newExpense, Date: e.target.value })
                    }
                    className="w-full px-3 py-2 border rounded-lg bg-gray-50 dark:bg-gray-800 dark:border-gray-700
              focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                {/* Buttons */}
                <div className="flex justify-end gap-3 mt-2">
                  <Button
                    variant="outline"
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="border-gray-300 dark:border-gray-600"
                  >
                    Cancel
                  </Button>
                  <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                    Add Expense
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {showFilterModal && (
          <div className="fixed inset-0 top-[-30px] bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-900 p-6 rounded-xl w-full max-w-md shadow-xl border dark:border-gray-700">

              {/* Header */}
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Filters
                </h2>
                <button
                  onClick={() => setShowFilterModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>

              {/* Filters */}
              <div className="space-y-4">

                {/* Category */}
                <div>
                  <Label>Category</Label>
                  <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                    <SelectTrigger>
                      <SelectValue placeholder="All categories" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All categories</SelectItem>
                      {categories.map((category) => (
                        <SelectItem key={category} value={category}>
                          {category}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Type */}
                <div>
                  <Label>Type</Label>
                  <Select value={selectedType} onValueChange={setSelectedType}>
                    <SelectTrigger>
                      <SelectValue placeholder="All types" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All types</SelectItem>
                      <SelectItem value="Cr.">Credit</SelectItem>
                      <SelectItem value="Dr.">Debit</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Year */}
                <div>
                  <Label>Year</Label>
                  <Select value={selectedYear} onValueChange={setSelectedYear}>
                    <SelectTrigger>
                      <SelectValue placeholder="All years" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All years</SelectItem>
                      {years.map((year) => (
                        <SelectItem key={year} value={year.toString()}>
                          {year}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Footer */}
              <div className="flex justify-end gap-2 mt-6">
                <Button
                  variant="outline"
                  onClick={() => {
                    setSelectedCategory("all")
                    setSelectedType("all")
                    setSelectedYear("all")
                  }}
                >
                  Clear
                </Button>

                <Button
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                  onClick={() => setShowFilterModal(false)}
                >
                  Apply
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}