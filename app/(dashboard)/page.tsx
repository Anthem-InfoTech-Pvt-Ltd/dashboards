"use client"

import ExpenseChatbot from "@/components/ExpenseChatbot"
import MainDashboard from "@/components/main-dashboard"
// import DashboardContent from "@/components/dashboard-content"
import { createContext, useContext, useState } from "react"
interface ThemeContextType {
  primaryColor: string
  secondaryColor: string
  setPrimaryColor: (color: string) => void
  setSecondaryColor: (color: string) => void
}
const ThemeContext = createContext<ThemeContextType>({
  primaryColor: "#10b981",
  secondaryColor: "#f59e0b",
  setPrimaryColor: () => { },
  setSecondaryColor: () => { },
})
export const useTheme = () => useContext(ThemeContext)

export default function Dashboard() {
  const [primaryColor, setPrimaryColor] = useState("#10b981")
  const [secondaryColor, setSecondaryColor] = useState("#f59e0b")

  return (
    <ThemeContext.Provider value={{ primaryColor, secondaryColor, setPrimaryColor, setSecondaryColor }}>
      {/* <DashboardContent /> */}
      <MainDashboard />
      <ExpenseChatbot />
    </ThemeContext.Provider>
  )
}
