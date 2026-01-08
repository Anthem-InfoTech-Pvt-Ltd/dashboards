# 📊 Anthem Dashboards

Anthem Dashboards is an internal web-based dashboard platform developed for Anthem Infotech Pvt. Ltd. to manage and visualize expense analytics and employee-related data through multiple dashboards.

Live URL: https://dashboards.workanthem.com

---

## Overview

The application provides multiple dashboards focused on expense management and financial analytics, along with employee and organization management.

---

## Expense Dashboards

- Live expense tracking
- Credit vs Debit analysis
- Net balance overview
- Yearly, monthly, and daily expense reports
- Category-wise expense trends
- Expense types management
- Detailed expense listings
- Financial insights with charts and graphs
- Global year selection across all expense dashboards

---

## Employee Dashboards

- Employee dashboard overview
- Employee listing and management
- Department management
- Role management
- Organization-related settings

---

## Tech Stack

Frontend:
- Next.js (App Router)
- TypeScript
- Tailwind CSS

Backend:
- Expense APIs built using Next.js API Routes
- Employee APIs built using Node.js + Express  
  Repository: https://github.com/Anthem-InfoTech-Pvt-Ltd/managementapinodejs

Database:
- Microsoft SQL Server (SSMS)
- Separate databases for Expense and Employee modules
- Both databases hosted on the same SQL Server instance

---

## Authentication

- Cookie-based authentication
- JWT (`access_token`) for secure sessions
- Google OAuth integration
- Server-side authentication for faster dashboard loading

---

## Performance Optimization

- Server-side rendering for dashboards
- Cookie-based user validation to avoid unnecessary API calls
- Optimized SQL queries
- Reduced loading states for better user experience

---

## Notes

- Expense and Employee modules are logically separated
- Both modules use SSMS with different databases
- Designed for internal enterprise use
- Easily scalable for future dashboards

---

## Maintained By

Anthem Infotech Pvt. Ltd.
