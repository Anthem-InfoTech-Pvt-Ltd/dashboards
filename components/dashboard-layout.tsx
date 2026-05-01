"use client"

import type React from "react"
import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ThemeToggle } from "@/components/theme-toggle"
import { CreditCard, Users, LayoutDashboard, LogOut, ChevronLeft, ChevronRight, Menu, X, ChevronRight as ArrowRight } from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { useAuth } from "@/context/auth-context"
import ExpenseChatbot from "./ExpenseChatbot"

interface DashboardLayoutProps {
  children: React.ReactNode
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const pathname = usePathname()
  const { user, loading, signOut } = useAuth()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [openMenu, setOpenMenu] = useState<string | null>(null)

  const menuItems = [
    { title: "Dashboard", icon: LayoutDashboard, href: "/" },
    {
      title: "Expenses",
      icon: CreditCard,
      href: "/expenses/dashboard",
      children: [
        { title: "Expenses List", href: "/expenses/expenses-list" },
        { title: "Expense Types", href: "/expenses/expense-types" },
      ],
    },
    {
      title: "Employees",
      icon: Users,
      href: "/employees/dashboard",
      children: [
        { title: "Employee List", href: "/employees/employees-list" },
        { title: "Roles", href: "/employees/roles" },
        // { title: "Departments", href: "/employees/departments" },
      ],
    },
  ]

  //   const menuItems = [
  //   { title: "Dashboard", icon: LayoutDashboard, href: "/" },

  //   {
  //     title: "Expenses",
  //     icon: CreditCard,
  //     href: "/expenses/dashboard",
  //     children: [
  //       { title: "Expenses List", href: "/expenses/expenses-list" },
  //       { title: "Expense Types", href: "/expenses/expense-types" },
  //     ],
  //   },

  //   // ⭐ SHOW Employees menu ONLY if email is allowed  
  //   ...(allowedEmployeeEmails.includes(user?.email)
  //     ? [
  //         {
  //           title: "Employees",
  //           icon: Users,
  //           href: "/employees/dashboard",
  //           children: [
  //             { title: "Employee List", href: "/employees/employees-list" },
  //             { title: "Roles", href: "/employees/roles" },
  //             { title: "Departments", href: "/employees/departments" },
  //           ],
  //         },
  //       ]
  //     : []),
  // ];

  // Open submenu based on current path
  useEffect(() => {
    const matchedMenu = menuItems.find(menu =>
      menu.children?.some(child => child.href === pathname)
    )
    if (matchedMenu) setOpenMenu(matchedMenu.title)
  }, [pathname])

  if (loading || (!user && !loading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="w-10 h-10 border-4 border-blue-600 border-dashed rounded-full animate-spin"></div>
      </div>
    )
  }

  // Helper to render menu button
  const renderMenuButton = (menu: typeof menuItems[0], isOpen: boolean) => {
    const hasChildren = !!menu.children?.length
    const isActive = pathname === menu.href

    return (
      <Link
        href={menu.href}
        className={cn(
          "w-full flex justify-between items-center px-3 py-2 rounded-md transition-colors hover:bg-blue-100 dark:hover:bg-gray-700",
          sidebarCollapsed && "justify-center",
          isActive && "bg-blue-600 text-white hover:bg-blue-700"
        )}
        onClick={() => {
          if (hasChildren) setOpenMenu(isOpen ? null : menu.title)
          setMobileMenuOpen(false)
        }}
        title={sidebarCollapsed ? menu.title : undefined} // Tooltip when collapsed
      >
        <div className="flex items-center gap-3">
          <menu.icon className="h-4 w-4" />
          {!sidebarCollapsed && <span>{menu.title}</span>}
        </div>
        {hasChildren && !sidebarCollapsed && (
          <ArrowRight className={cn("h-4 w-4 transition-transform", isOpen && "rotate-90")} />
        )}
      </Link>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Mobile menu toggle */}
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="bg-white dark:bg-gray-800"
        >
          {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </Button>
      </div>

      {mobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={cn(
          "fixed left-0 top-0 z-40 h-full bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 transition-all duration-300 ease-in-out",
          sidebarCollapsed ? "w-16" : "w-64",
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        )}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          {!sidebarCollapsed && (
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 flex items-center justify-center">
                <img
                  src="https://res.cloudinary.com/dmyq2ymj9/image/upload/v1753870586/anthem_infotech_pvt_ltd__logo-removebg-preview_qd1tk4.png"
                  alt="Logo"
                />
              </div>
              <span className="font-semibold text-gray-900 dark:text-white">Dashboards</span>
            </div>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="hidden lg:flex"
          >
            {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>
        </div>

        <nav className="p-4 space-y-2">
          {menuItems.map(menu => {
            const isOpen = openMenu === menu.title
            const hasChildren = !!menu.children?.length

            return (
              <div key={menu.title}>
                {renderMenuButton(menu, isOpen)}

                {hasChildren && !sidebarCollapsed && isOpen && (
                  <div className="ml-8 mt-1 flex flex-col space-y-1">
                    {menu.children!.map(sub => (
                      <Link key={sub.href} href={sub.href}>
                        <Button
                          variant={pathname === sub.href ? "default" : "ghost"}
                          className={cn(
                            "w-full justify-start text-sm rounded-md transition-colors hover:bg-blue-100 dark:hover:bg-gray-700",
                            pathname === sub.href && "bg-blue-600 text-white hover:bg-blue-700"
                          )}
                          onClick={() => setMobileMenuOpen(false)}
                        >
                          {sub.title}
                        </Button>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </nav>

        <div className="absolute bottom-4 left-4 right-4 space-y-2">

          {/* AI Help */}
          <Button
            variant="ghost"
            onClick={() => window.dispatchEvent(new Event("openExpenseChatbot"))}
            className={cn(
              "w-full justify-start gap-3 hover:bg-blue-50 dark:hover:bg-gray-700 rounded-md",
              sidebarCollapsed && "justify-center px-2"
            )}
          >
            <svg width="20" height="14" viewBox="0 0 100 70" fill="none">
              <ellipse cx="8" cy="35" rx="8" ry="12" fill="#2563eb" />
              <ellipse cx="92" cy="35" rx="8" ry="12" fill="#2563eb" />
              <rect x="14" y="5" width="72" height="60" rx="10" fill="#2563eb" />
              <ellipse cx="36" cy="30" rx="6" ry="8" fill="white" />
              <ellipse cx="64" cy="30" rx="6" ry="8" fill="white" />
              <rect x="35" y="46" width="30" height="10" rx="3" fill="white" />
              <rect x="42" y="49" width="16" height="4" rx="1" fill="#2563eb" />
            </svg>
            {!sidebarCollapsed && <span>AI Help</span>}
          </Button>

          {/* Logout */}
          <Button
            variant="ghost"
            className={cn(
              "w-full justify-start gap-3 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md",
              sidebarCollapsed && "justify-center px-2"
            )}
            onClick={signOut}
          >
            <LogOut className="h-4 w-4" />
            {!sidebarCollapsed && <span>Logout</span>}
          </Button>
        </div>

        <div className="absolute bottom-4 left-4 right-4">
          <Button
            variant="ghost"
            className={cn(
              "w-full justify-start gap-3 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md",
              sidebarCollapsed && "justify-center px-2"
            )}
            onClick={signOut}
          >
            <LogOut className="h-4 w-4" />
            {!sidebarCollapsed && <span>Logout</span>}
          </Button>
        </div>
      </div>

      {/* Main content */}
      <div className={cn("transition-all duration-300 ease-in-out", sidebarCollapsed ? "lg:ml-16" : "lg:ml-64")}>
        <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex justify-end items-center gap-4">
          <ThemeToggle />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Avatar className="h-8 w-8 cursor-pointer">
                <AvatarImage src="/placeholder-user.jpg" alt="User" />
                <AvatarFallback>U</AvatarFallback>
              </Avatar>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>My Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/settings">Settings</Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-red-600 cursor-pointer" onClick={signOut}>
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>
        <main className="p-6">{children}</main>
        <ExpenseChatbot />
      </div>
    </div>
  )
}