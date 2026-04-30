// app/api/chatbot/route.ts
import { NextRequest, NextResponse } from "next/server";
import { sql, config } from "@/lib/db";
import { corsHeaders } from "@/lib/cors";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

export async function OPTIONS() {
    return new Response(null, { headers: corsHeaders });
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { message, conversationHistory = [] } = body;

        const cookieStore = await cookies();
        const email = cookieStore.get("user_email")?.value?.trim();

        let userId: number | null = null;
        let currency = "₹";

        const pool = await sql.connect(config);

        if (email) {
            const userResult = await pool.query`
                SELECT UserId, Currency
                FROM [dbo].[tblUsers]
                WHERE EmailId = ${email}
            `;
            const user = userResult.recordset?.[0];
            if (!user) {
                return NextResponse.json(
                    { error: "User not found" },
                    { status: 404, headers: corsHeaders }
                );
            }
            userId = user.UserId;
            currency = user.Currency === "USD" ? "$" : "₹";

        } else if (body.userId) {
            userId = body.userId;
            const userResult = await pool.query`
                SELECT Currency FROM [dbo].[tblUsers] WHERE UserId = ${userId}
            `;
            const user = userResult.recordset?.[0];
            if (user) currency = user.Currency === "USD" ? "$" : "₹";

        } else {
            return NextResponse.json(
                { error: "Not authenticated" },
                { status: 401, headers: corsHeaders }
            );
        }

        if (!message) {
            return NextResponse.json(
                { error: "Message is required" },
                { status: 400, headers: corsHeaders }
            );
        }

        // Fetch Active Categories
        const categoriesResult = await pool.query`
            SELECT ExpenseTypeName
            FROM dbo.tbl_Exensedesctypes
            WHERE UserId = ${userId} AND IsDeleted = 0
        `;
        const activeCategories = categoriesResult.recordset.map((c: any) => c.ExpenseTypeName.trim());

        // Fetch All Expenses
        const result = await pool.query`
            SELECT 
                e.ExpenseId,
                e.Expenses,
                e.Description,
                e.Date,
                e.Balance,
                e.ExpenseDescType,
                et.Type AS ExpenseType
            FROM [dbo].[tbl_Expenses] e
            LEFT JOIN [dbo].[tbl_Expensetype] et 
                ON e.ExpenseTypeId = et.ExpenseTypeId
            WHERE e.UserId = ${userId} 
                AND e.IsDeleted = 0
            ORDER BY e.Date ASC
        `;

        const data = result.recordset;

        if (!data || data.length === 0) {
            return NextResponse.json(
                { reply: "No transactions found. / कोई लेन-देन नहीं मिला।" },
                { status: 200, headers: corsHeaders }
            );
        }

        const now = new Date();
        const currentDate = now.toLocaleDateString("en-GB");
        const currentMonth = now.getMonth() + 1;
        const currentYear = now.getFullYear();
        const currentMonthName = now.toLocaleString("en-US", { month: "long" });

        const summary = buildSummary(
            data, currency, activeCategories,
            currentMonth, currentYear, currentMonthName, currentDate
        );

        // ── Step 1: Explicit chart request by user ──
        const explicitChartType = detectExplicitChartIntent(message);

        // ── Step 2: Smart auto-chart for meaningful questions (no explicit request) ──
        const autoChartType = explicitChartType ? null : detectAutoChartIntent(message);

        const chartType = explicitChartType ?? autoChartType;
        let chartData: object | undefined = undefined;

        if (chartType) {
            const targetYear = extractYearFromMessage(message, currentYear);
            const built = buildChartData(
                chartType, data, activeCategories, currency,
                currentMonth, targetYear, currentMonthName
            );
            if (built) chartData = built;
        }

        const claudeReply = await callClaude(message, summary, conversationHistory, !!chartData);

        return NextResponse.json(
            {
                reply: claudeReply,
                ...(chartData ? { chartData } : {}),
            },
            { status: 200, headers: corsHeaders }
        );

    } catch (error) {
        console.error("Chatbot Error:", error);
        return NextResponse.json(
            { error: "Internal Server Error" },
            { status: 500, headers: corsHeaders }
        );
    }
}

// ==================== EXTRACT YEAR ====================
function extractYearFromMessage(message: string, defaultYear: number): number {
    const match = message.match(/\b(20\d{2})\b/);
    if (match) {
        const yr = parseInt(match[1], 10);
        if (yr >= 2000 && yr <= 2099) return yr;
    }
    return defaultYear;
}

// ==================== EXPLICIT CHART INTENT ====================
function detectExplicitChartIntent(message: string): string | null {
    const msg = message.toLowerCase();

    // Daywise — must mention day/daily + chart context
    if (/day[\s-]?wise|daywise|daily[\s-]?chart|daily[\s-]?trend|din[\s-]?ke[\s-]?hisab|rozana[\s-]?chart|per[\s-]?day[\s-]?chart/i.test(msg)) {
        return "daywise";
    }

    // Tree chart — explicit
    if (/tree[\s-]?chart|tree[\s-]?map|treemap|hierarchy[\s-]?chart|category[\s-]?tree|ped[\s-]?chart|tree[\s-]?dikhao|tree[\s-]?graph/i.test(msg)) {
        return "tree";
    }

    // Radar / Spider — explicit
    if (/radar[\s-]?chart|radar[\s-]?graph|spider[\s-]?chart|web[\s-]?chart/i.test(msg)) {
        return "radar";
    }

    // Stacked bar (vertical, monthly) — explicit
    if (/stacked[\s-]?bar|stack[\s-]?chart|stacked[\s-]?chart/i.test(msg)) {
        return "stackedBar";
    }

    // Donut — explicit
    if (/donut[\s-]?chart|doughnut[\s-]?chart/i.test(msg)) {
        return "donut";
    }

    // Pie — explicit
    if (/\bp[iea]{1,3}\s*chart\b|pie[\s-]?chart/i.test(msg)) {
        return "pie";
    }

    // Credit vs Debit pie
    if (/(credit.*debit|debit.*credit)/i.test(msg) && /chart|graph|visual|pie|dikhao/i.test(msg)) {
        return "creditDebitPie";
    }

    // Horizontal bar — explicit
    if (/horizontal[\s-]?bar[\s-]?chart|hbar[\s-]?chart/i.test(msg)) {
        return "horizontalBar";
    }

    // Yearly stacked bar (year × category horizontal) — explicit
    if (/yearly[\s-]?debit[\s-]?by[\s-]?categor|year[\s-]?wise[\s-]?categor[\s-]?chart|categor[\s-]?year[\s-]?wise[\s-]?chart/i.test(msg)) {
        return "yearlyStackedBar";
    }

    // Bar chart — explicit
    if (/bar[\s-]?chart|column[\s-]?chart|bar[\s-]?graph/i.test(msg)) {
        return "bar";
    }

    // Area chart — explicit
    if (/area[\s-]?chart|filled[\s-]?line[\s-]?chart/i.test(msg)) {
        return "area";
    }

    // Line chart — explicit
    if (/line[\s-]?chart|line[\s-]?graph/i.test(msg)) {
        return "line";
    }

    return null;
}

// ==================== AUTO CHART INTENT ====================
function detectAutoChartIntent(message: string): string | null {
    const msg = message.toLowerCase();

    // ── BLOCK LIST ──
    const noChartPatterns = [
        /\bbalance\b|\bbaaki\b|\bbakaya\b/,
        /recent|latest|last\s+\d*\s*transaction|aakhri|pichhla\s*transaction/,
        /how many|kitne\s*transaction|count\s*transaction/,
        /^(hi|hello|hey|namaste|hii|helo|hola)\b/,
        /thank|shukriya|dhanyawad/,
        /\bhelp\b.*\bkya\b|\bkya\b.*\bpuchh\b/,
        /which\s*app|konsa\s*app|is app|app\s*feature/,
        /what is|kya hai|define|explain|matlab/,
        /total\s*(credit|debit|income|expense|kharch)\s*kitna|kitna\s*(credit|debit|income|kharch)\s*total/,
        /aaj\s*(ka|kitna)|today's?\s*(expense|balance|total)/,
        /last\s*entry|latest\s*entry|last\s*added/,
    ];
    if (noChartPatterns.some(p => p.test(msg))) return null;

    // ── PRIORITY 1 — Day-wise (explicit daywise keyword) ──
    if (/day[\s-]?wise|daywise|rozana\s*data|daily\s*data|har\s*roz\s*(ka\s*)?(data|kharch)/i.test(msg)) {
        return "daywise";
    }

    // ── PRIORITY 2 — Yearly credit+debit day-wise chart ──
    // Triggers: "2025 credit debit", "all credit debits of 2025", "saal bhar credit debit",
    //           "yearly credit vs debit chart", "poore saal ka credit aur debit",
    //           "annual credit debit", "2025 ka sara credit debit", "show me credit and debit for 2025"
    // NOTE: credits/debits (plural) are intentionally matched with s? suffix everywhere
    if (/(20\d{2})\s*(ka\s*)?(sara\s*)?(credits?|debits?|transactions?)/i.test(msg)) return "daywise";
    if (/yearly\s*(credits?|debits?)\s*(vs|aur|and|chart|graph|dikhao)/i.test(msg)) return "daywise";
    if (/(credits?|debits?)\s*(vs|aur|and)\s*(credits?|debits?)\s*(yearly|saal|annual|poore?\s*saal)/i.test(msg)) return "daywise";
    if (/saal[\s-]?bhar\s*(ka\s*)?(credits?|debits?|transactions?)/i.test(msg)) return "daywise";
    if (/poore?\s*saal\s*(ka\s*)?(credits?|debits?|transactions?)/i.test(msg)) return "daywise";
    if (/annual\s*(credits?|debits?)\s*(vs|and|aur|chart|data|summary)/i.test(msg)) return "daywise";
    if (/(credits?|debits?)\s*(aur|and|vs)\s*(debits?|credits?)\s*(20\d{2}|saal|year|yearly|annual)/i.test(msg)) return "daywise";
    if (/all\s*(credits?|debits?)\s*(of|in|for)\s*(20\d{2}|this\s*year|current\s*year)/i.test(msg)) return "daywise";
    if (/(20\d{2})\s*(mein|me|ka|ke)\s*(sare|sara|all|poore?)\s*(credits?|debits?|transactions?)/i.test(msg)) return "daywise";
    // "all credit debits of 2025" — "credit debits" together near a year
    if (/(credits?\s+debits?|debits?\s+credits?)\s*(of|in|for|20\d{2})/i.test(msg)) return "daywise";
    if (/(of|in|for|show)\s*(20\d{2})\s*(credits?\s*[&and]*\s*debits?|debits?\s*[&and]*\s*credits?)/i.test(msg)) return "daywise";
    // "show credit and debit for 2025", "show me credits and debits of 2025"
    if (/(show|dikhao|dekho|show\s*me)\s*(me\s*)?(credits?\s*(and|aur|&)\s*debits?|debits?\s*(and|aur|&)\s*credits?)/i.test(msg)) return "daywise";
    if (/(credits?\s*(and|aur|&)\s*debits?|debits?\s*(and|aur|&)\s*credits?)\s*(of|in|for|20\d{2})/i.test(msg)) return "daywise";

    // ── PRIORITY 3 — Yearly stacked bar (year × category, ALL TIME) ──
    if (/yearly\s*(debit|expense|kharch)\s*(by\s*)?categor/i.test(msg)) return "yearlyStackedBar";
    if (/year[\s-]?wise\s*(debit|expense|kharch)?\s*categor|categor.*year[\s-]?wise/i.test(msg)) return "yearlyStackedBar";
    if (/all[\s-]?time\s*(category|categor|kharch)\s*(by\s*)?year|categor.*all[\s-]?time.*year/i.test(msg)) return "yearlyStackedBar";
    if (/har\s*saal\s*(ki\s*)?(category|categor|kharch)|saal[\s-]?ke[\s-]?hisab\s*(se\s*)?(categor|kharch)/i.test(msg)) return "yearlyStackedBar";
    if (/poore?\s*(time|samay|data)\s*(mein\s*)?(categor|kharch)|categor.*poore?\s*(time|samay)/i.test(msg)) return "yearlyStackedBar";
    if (/(category|categor)\s*(breakdown|split)\s*(by\s*)?year|(year|saal)\s*(wise\s*)?(category|categor)\s*(breakdown|split)/i.test(msg)) return "yearlyStackedBar";

    // ── PRIORITY 4 — Tree chart ──
    if (/category\s*(hierarchy|tree|breakdown\s*all|split\s*all)|all\s*time\s*category|sabhi\s*categor/i.test(msg)) {
        return "tree";
    }

    // ── PRIORITY 5 — Radar ──
    if (/(last|pichhl[ae])\s*month.*(vs|versus|compare|aur).*(this|is|current)\s*month/i.test(msg)) return "radar";
    if (/(this|is|current)\s*month.*(vs|versus|compare|aur).*(last|pichhl[ae])\s*month/i.test(msg)) return "radar";
    if (/monthly\s*(credit|debit)\s*(vs|versus|aur|and)\s*(credit|debit)/i.test(msg)) return "radar";
    if (/(last|pichhl[ae])\s*month\s*(vs|compare|aur)\s*(this|current|is)\s*month/i.test(msg)) return "radar";

    // ── PRIORITY 6 — Stacked bar (category × month matrix) ──
    if (/category\s*month[\s-]?wise|month[\s-]?wise\s*category|categor.*har\s*mahine|har\s*mahine.*categor/i.test(msg)) return "stackedBar";
    if (/monthly\s*category\s*(breakdown|split|detail)|category\s*wise\s*monthly/i.test(msg)) return "stackedBar";

    // ── PRIORITY 7 — Credit vs Debit Pie ──
    // Guard: skip if a year / yearly keyword is present (those are handled by Priority 2 → daywise)
    if (!/20\d{2}|saal[\s-]?bhar|poore?\s*saal|yearly|annual/i.test(msg)) {
        if (/(credit|income|aay)\s*(vs|versus|aur|and|compared\s*to)\s*(debit|expense|kharch)/i.test(msg)) return "creditDebitPie";
        if (/(debit|expense|kharch)\s*(vs|versus|aur|and|compared\s*to)\s*(credit|income|aay)/i.test(msg)) return "creditDebitPie";
        if (/overall\s*(credit|debit)\s*(vs|split|ratio|percentage)/i.test(msg)) return "creditDebitPie";
    }

    // ── PRIORITY 8 — Pie (this-month category) ──
    if (/this\s*month.*categor|is\s*mahine.*categor|categor.*this\s*month|categor.*is\s*mahine/i.test(msg)) return "pie";
    if (/monthly\s*expense\s*distribution|mahine\s*ka\s*share|is\s*mahine\s*ka\s*breakdown/i.test(msg)) return "pie";
    if (/category\s*(breakdown|split|distribution|wise)\s*(this|current|is)?\s*month/i.test(msg)) return "pie";

    // ── PRIORITY 9 — Horizontal bar (top categories) ──
    if (/top\s*\d*\s*(categor|expense|kharch|spending)/i.test(msg)) return "horizontalBar";
    if (/sabse\s*zyada\s*(kharch|expense)|highest\s*(spend|expense)|maximum\s*(spend|expense)/i.test(msg)) return "horizontalBar";
    if (/ranking\s*(of\s*)?(categor|expense)|categor.*rank/i.test(msg)) return "horizontalBar";
    if (/overall\s*(spend|expense|kharch)\s*(by\s*)?categor|total\s*categor.*all\s*time/i.test(msg)) return "horizontalBar";

    // ── PRIORITY 10 — Area (full-year trend) ──
    if (/full[\s-]?year\s*(expense|kharch|spend|data|summary|trend)/i.test(msg)) return "area";
    if (/annual\s*(expense|kharch|spend|summary|breakdown|trend)/i.test(msg)) return "area";
    if (/saal[\s-]?bhar\s*(ka\s*)?(kharch|expense)/i.test(msg)) return "area";
    if (/poore\s*saal\s*(ka\s*)?(kharch|expense)/i.test(msg)) return "area";
    if (/(expense|kharch|spend)\s*(of|in|for)\s*20\d{2}/i.test(msg) && !/month/i.test(msg)) return "area";

    // ── PRIORITY 11 — Line (trend) ──
    if (/trend|spending\s*pattern|expense\s*pattern/i.test(msg)) return "line";
    if (/over\s*time|time\s*series|month\s*over\s*month/i.test(msg)) return "line";

    // ── PRIORITY 12 — Bar (monthly breakdown) ──
    if (/month[\s-]?wise\s*(expense|kharch|spend|breakdown|summary|report)/i.test(msg)) return "bar";
    if (/monthly\s*(expense|kharch|spend)\s*(breakdown|summary|report|comparison)/i.test(msg)) return "bar";
    if (/har\s*mahine\s*(ka\s*)?(kharch|expense|total)/i.test(msg)) return "bar";
    if (/mahine\s*ke\s*hisab\s*(se\s*)?(kharch|expense)/i.test(msg)) return "bar";
    if (/year(ly)?\s*(overview|summary|expense|breakdown)\s*(by\s*month|monthly)?/i.test(msg) && !/full/i.test(msg)) return "bar";

    return null;
}

// ==================== BUILD CHART DATA ====================
function buildChartData(
    chartType: string,
    data: any[],
    activeCategories: string[],
    currency: string,
    currentMonth: number,
    targetYear: number,
    currentMonthName: string
): object | null {

    // This-month category map (debits only)
    const thisMonthData = data.filter((e) => {
        const d = new Date(e.Date);
        return d.getMonth() + 1 === currentMonth && d.getFullYear() === targetYear;
    });

    const categoryMap: Record<string, number> = {};
    thisMonthData.forEach((e) => {
        if (e.ExpenseType !== "Cr.") {
            const rawCat = (e.ExpenseDescType || e.Description || "Other").trim();
            const cat = activeCategories.includes(rawCat) ? rawCat : "Other";
            categoryMap[cat] = (categoryMap[cat] || 0) + Number(e.Expenses);
        }
    });

    const categoryLabels = Object.keys(categoryMap);
    const categoryValues = Object.values(categoryMap);

    // Monthly totals for targetYear
    const monthOrder = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
        "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    const monthMap: Record<string, { debit: number; credit: number }> = {};
    data.forEach((e) => {
        const d = new Date(e.Date);
        if (d.getFullYear() === targetYear) {
            const monthKey = monthOrder[d.getMonth()];
            if (!monthMap[monthKey]) monthMap[monthKey] = { debit: 0, credit: 0 };
            if (e.ExpenseType === "Cr.") monthMap[monthKey].credit += Number(e.Expenses);
            else monthMap[monthKey].debit += Number(e.Expenses);
        }
    });

    const sortedMonths = monthOrder.filter((m) => monthMap[m]);
    const monthDebits = sortedMonths.map((m) => Math.round(monthMap[m].debit));
    const monthCredits = sortedMonths.map((m) => Math.round(monthMap[m].credit));

    // All-time totals
    let totalCredit = 0;
    let totalDebit = 0;
    data.forEach((e) => {
        if (e.ExpenseType === "Cr.") totalCredit += Number(e.Expenses);
        else totalDebit += Number(e.Expenses);
    });

    // All-time category totals (debit)
    const allCategoryMap: Record<string, number> = {};
    data.forEach((e) => {
        if (e.ExpenseType !== "Cr.") {
            const rawCat = (e.ExpenseDescType || e.Description || "Other").trim();
            const cat = activeCategories.includes(rawCat) ? rawCat : "Other";
            allCategoryMap[cat] = (allCategoryMap[cat] || 0) + Number(e.Expenses);
        }
    });

    switch (chartType) {

        // ── Daywise ──
        case "daywise": {
            const dayCreditMap: Record<number, number> = {};
            const dayDebitMap: Record<number, number> = {};
            data.forEach((e) => {
                const d = new Date(e.Date);
                if (d.getFullYear() === targetYear) {
                    const ts = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
                    if (e.ExpenseType === "Cr.") dayCreditMap[ts] = (dayCreditMap[ts] || 0) + Number(e.Expenses);
                    else dayDebitMap[ts] = (dayDebitMap[ts] || 0) + Number(e.Expenses);
                }
            });
            const creditSeries: [number, number][] = Object.entries(dayCreditMap).map(([ts, v]) => [Number(ts), Math.round(v)]).sort((a, b) => a[0] - b[0]);
            const debitSeries: [number, number][] = Object.entries(dayDebitMap).map(([ts, v]) => [Number(ts), Math.round(v)]).sort((a, b) => a[0] - b[0]);
            if (!creditSeries.length && !debitSeries.length) return null;
            return { type: "daywise", title: `${targetYear} — Day-wise Transactions`, currency, creditSeries, debitSeries };
        }

        // ── Tree ──
        case "tree": {
            const sortedCats = Object.entries(allCategoryMap).sort((a, b) => b[1] - a[1]);
            if (!sortedCats.length) return null;
            const nodes = [
                { id: "root", name: "All Expenses", value: Math.round(totalDebit), parent: null },
                ...sortedCats.map(([cat, val], i) => ({
                    id: `cat_${i}`, name: cat, value: Math.round(val),
                    parent: "root", pct: ((val / totalDebit) * 100).toFixed(1),
                })),
            ];
            return { type: "tree", title: `All Time — Expense Category Tree`, currency, nodes, totalDebit: Math.round(totalDebit) };
        }

        // ── Radar ──
        case "radar": {
            const lastMonth = currentMonth === 1 ? 12 : currentMonth - 1;
            const lastMonthYear = currentMonth === 1 ? targetYear - 1 : targetYear;
            const lastMonthCatMap: Record<string, number> = {};
            data.forEach((e) => {
                const d = new Date(e.Date);
                if (d.getMonth() + 1 === lastMonth && d.getFullYear() === lastMonthYear && e.ExpenseType !== "Cr.") {
                    const rawCat = (e.ExpenseDescType || e.Description || "Other").trim();
                    const cat = activeCategories.includes(rawCat) ? rawCat : "Other";
                    lastMonthCatMap[cat] = (lastMonthCatMap[cat] || 0) + Number(e.Expenses);
                }
            });
            const allCats = Array.from(new Set([...Object.keys(categoryMap), ...Object.keys(lastMonthCatMap)]));
            if (!allCats.length) return null;
            const lastMonthName = new Date(lastMonthYear, lastMonth - 1, 1).toLocaleString("en-US", { month: "long" });
            return {
                type: "radar",
                title: `${lastMonthName} vs ${currentMonthName} — Category Radar`,
                currency, labels: allCats,
                datasets: [
                    { label: lastMonthName, data: allCats.map((c) => Math.round(lastMonthCatMap[c] || 0)) },
                    { label: currentMonthName, data: allCats.map((c) => Math.round(categoryMap[c] || 0)) },
                ],
            };
        }

        // ── Stacked bar (monthly × category) ──
        case "stackedBar": {
            const yearCatMonthMap: Record<string, Record<string, number>> = {};
            data.forEach((e) => {
                const d = new Date(e.Date);
                if (d.getFullYear() === targetYear && e.ExpenseType !== "Cr.") {
                    const monthKey = monthOrder[d.getMonth()];
                    const rawCat = (e.ExpenseDescType || e.Description || "Other").trim();
                    const cat = activeCategories.includes(rawCat) ? rawCat : "Other";
                    if (!yearCatMonthMap[cat]) yearCatMonthMap[cat] = {};
                    yearCatMonthMap[cat][monthKey] = (yearCatMonthMap[cat][monthKey] || 0) + Number(e.Expenses);
                }
            });
            const cats = Object.keys(yearCatMonthMap);
            if (!cats.length || !sortedMonths.length) return null;
            return {
                type: "stackedBar",
                title: `${targetYear} — Monthly Category Breakdown`,
                currency, labels: sortedMonths,
                datasets: cats.map((cat) => ({
                    label: cat,
                    data: sortedMonths.map((m) => Math.round(yearCatMonthMap[cat][m] || 0)),
                })),
            };
        }

        // ── Yearly Stacked Bar (year × category, ALL TIME, horizontal) ──
        case "yearlyStackedBar": {
            const yearCatMap: Record<string, Record<string, number>> = {};
            data.forEach((e) => {
                if (e.ExpenseType === "Cr.") return;
                const d = new Date(e.Date);
                const yr = String(d.getFullYear());
                const rawCat = (e.ExpenseDescType || e.Description || "Other").trim();
                const cat = activeCategories.includes(rawCat) ? rawCat : "Other";
                if (!yearCatMap[yr]) yearCatMap[yr] = {};
                yearCatMap[yr][cat] = (yearCatMap[yr][cat] || 0) + Number(e.Expenses);
            });

            const years = Object.keys(yearCatMap).sort();
            if (!years.length) return null;

            const allCats = Object.entries(allCategoryMap)
                .sort((a, b) => b[1] - a[1])
                .map(([cat]) => cat);

            if (!allCats.length) return null;

            return {
                type: "yearlyStackedBar",
                title: `Yearly Debit by Category — All Time`,
                currency,
                labels: years,
                datasets: allCats.map((cat) => ({
                    label: cat,
                    data: years.map((yr) => Math.round(yearCatMap[yr]?.[cat] || 0)),
                })),
            };
        }

        // ── Credit vs Debit Pie ──
        case "creditDebitPie":
            if (!totalCredit && !totalDebit) return null;
            return {
                type: "pie",
                title: `Overall Credit vs Debit`,
                currency,
                labels: ["Credit (आय)", "Debit (खर्च)"],
                datasets: [{ data: [Math.round(totalCredit), Math.round(totalDebit)] }],
            };

        // ── Pie ──
        case "pie":
            if (!categoryLabels.length) return null;
            return {
                type: "pie",
                title: `${currentMonthName} ${targetYear} — Category Breakdown`,
                currency, labels: categoryLabels,
                datasets: [{ data: categoryValues.map(Math.round) }],
            };

        // ── Donut ──
        case "donut":
            if (!categoryLabels.length) return null;
            return {
                type: "donut",
                title: `${currentMonthName} ${targetYear} — Expense Distribution`,
                currency, labels: categoryLabels,
                datasets: [{ data: categoryValues.map(Math.round) }],
            };

        // ── Bar ──
        case "bar":
            if (!sortedMonths.length) return null;
            return {
                type: "bar",
                title: `${targetYear} — Monthly Debit vs Credit`,
                currency, labels: sortedMonths,
                datasets: [
                    { label: "Debit", data: monthDebits },
                    { label: "Credit", data: monthCredits },
                ],
            };

        // ── Line ──
        case "line":
            if (!sortedMonths.length) return null;
            return {
                type: "line",
                title: `${targetYear} — Monthly Expense Trend`,
                currency, labels: sortedMonths,
                datasets: [
                    { label: "Debit", data: monthDebits },
                    { label: "Credit", data: monthCredits },
                ],
            };

        // ── Area ──
        case "area":
            if (!sortedMonths.length) return null;
            return {
                type: "area",
                title: `${targetYear} — Cumulative Expense Trend`,
                currency, labels: sortedMonths,
                datasets: [
                    { label: "Debit", data: monthDebits },
                    { label: "Credit", data: monthCredits },
                ],
            };

        // ── Horizontal Bar ──
        case "horizontalBar": {
            const sorted = Object.entries(allCategoryMap)
                .map(([label, value]) => ({ label, value }))
                .sort((a, b) => b.value - a.value)
                .slice(0, 8);
            if (!sorted.length) return null;
            return {
                type: "horizontalBar",
                title: `Top Spending Categories (All Time)`,
                currency,
                labels: sorted.map((s) => s.label),
                datasets: [{ label: "Expense", data: sorted.map((s) => Math.round(s.value)) }],
            };
        }

        default:
            return null;
    }
}

// ==================== BUILD SUMMARY ====================
function buildSummary(
    data: any[], currency: string, activeCategories: string[],
    currentMonth: number, currentYear: number,
    currentMonthName: string, currentDate: string
): string {
    let totalCredit = 0;
    let totalDebit = 0;

    const thisMonthData = data.filter((e) => {
        const d = new Date(e.Date);
        return d.getMonth() + 1 === currentMonth && d.getFullYear() === currentYear;
    });

    let thisMonthCredit = 0;
    let thisMonthDebit = 0;
    thisMonthData.forEach((e) => {
        const amount = Number(e.Expenses);
        if (e.ExpenseType === "Cr.") thisMonthCredit += amount;
        else thisMonthDebit += amount;
    });

    const categoryMap: Record<string, { credit: number; debit: number; count: number }> = {};
    data.forEach((e) => {
        const amount = Number(e.Expenses);
        const isCredit = e.ExpenseType === "Cr.";
        const rawCat = (e.ExpenseDescType || e.Description || "Other").trim();
        const cat = activeCategories.includes(rawCat) ? rawCat : "Other";
        if (isCredit) totalCredit += amount;
        else totalDebit += amount;
        if (!categoryMap[cat]) categoryMap[cat] = { credit: 0, debit: 0, count: 0 };
        if (isCredit) categoryMap[cat].credit += amount;
        else categoryMap[cat].debit += amount;
        categoryMap[cat].count++;
    });

    const balance = totalCredit - totalDebit;
    const newest = [...data].reverse()[0];
    const latestBalance = newest?.Balance ?? balance;

    const recent5 = [...data].reverse().slice(0, 5)
        .map((e) => `${new Date(e.Date).toLocaleDateString("en-GB")} ${e.ExpenseType} ${currency}${Number(e.Expenses).toLocaleString()} [${e.ExpenseDescType || e.Description}]`)
        .join("\n");

    const categoryLines = Object.entries(categoryMap)
        .sort((a, b) => (b[1].debit + b[1].credit) - (a[1].debit + a[1].credit))
        .map(([cat, val]) => `${cat}: Dr${currency}${val.debit.toLocaleString()} Cr${currency}${val.credit.toLocaleString()} (${val.count})`)
        .join("\n");

    const thisMonthLines = thisMonthData.length > 0
        ? thisMonthData.map((e) => `${new Date(e.Date).toLocaleDateString("en-GB")} ${e.ExpenseType} ${currency}${Number(e.Expenses).toLocaleString()} [${e.ExpenseDescType || e.Description}]`).join("\n")
        : `No transactions in ${currentMonthName} ${currentYear}.`;

    const monthCatMap: Record<string, Record<string, { dr: number; cr: number; count: number }>> = {};
    data.forEach((e) => {
        const d = new Date(e.Date);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        const rawCat = (e.ExpenseDescType || e.Description || "Other").trim();
        const cat = activeCategories.includes(rawCat) ? rawCat : "Other";
        const amount = Number(e.Expenses);
        const isCredit = e.ExpenseType === "Cr.";
        if (!monthCatMap[key]) monthCatMap[key] = {};
        if (!monthCatMap[key][cat]) monthCatMap[key][cat] = { dr: 0, cr: 0, count: 0 };
        if (isCredit) monthCatMap[key][cat].cr += amount;
        else monthCatMap[key][cat].dr += amount;
        monthCatMap[key][cat].count++;
    });

    const monthCatLines = Object.entries(monthCatMap)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, cats]) => {
            const catStr = Object.entries(cats)
                .filter(([, v]) => v.dr > 0 || v.cr > 0)
                .sort((a, b) => (b[1].dr + b[1].cr) - (a[1].dr + a[1].cr))
                .map(([cat, v]) => {
                    const parts: string[] = [];
                    if (v.dr > 0) parts.push(`Dr${v.dr}`);
                    if (v.cr > 0) parts.push(`Cr${v.cr}`);
                    return `${cat}:${parts.join("+")}(${v.count})`;
                }).join(",");
            return `${key}|${catStr}`;
        }).join("\n");

    return `
DATE:${currentDate} CUR:${currency} TXNS:${data.length}
BAL:${currency}${Number(latestBalance).toLocaleString()} TOTAL_CR:${currency}${totalCredit.toLocaleString()} TOTAL_DR:${currency}${totalDebit.toLocaleString()} NET:${currency}${balance.toLocaleString()}

THIS_MONTH(${currentMonthName} ${currentYear}):
CR:${currency}${thisMonthCredit.toLocaleString()} DR:${currency}${thisMonthDebit.toLocaleString()} NET:${currency}${(thisMonthCredit - thisMonthDebit).toLocaleString()} COUNT:${thisMonthData.length}
${thisMonthLines}

RECENT_5:
${recent5}

CATEGORY_TOTALS:
${categoryLines}

MONTH_CATEGORY(YYYY-MM|Cat:DrAmt+CrAmt(count)):
${monthCatLines}
`.trim();
}

// ==================== CALL CLAUDE ====================
async function callClaude(
    userMessage: string,
    summary: string,
    conversationHistory: { role: string; content: string }[] = [],
    hasChart: boolean = false
): Promise<string> {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("API key not configured");

    const systemPrompt = `You are a friendly and precise personal finance assistant with COMPLETE access to the user's transaction history.

<data>
${summary}
</data>

CRITICAL OUTPUT RULES:

0. NEVER OUTPUT HTML/IFRAMES/LINKS: NEVER include <iframe>, <img>, <a href>, URLs, or HTML tags. NEVER reference external chart tools. The chart is ALREADY rendered by the app — you only write plain text.

1. LANGUAGE: Mirror user exactly — English→English, Hindi/Hinglish→Hindi/Hinglish.

2. DATA: You have ALL data for ALL months and categories. NEVER say data is unavailable.
   - MONTH_CATEGORY format: YYYY-MM|Category:DrAmount+CrAmount(count)
   - For "this month/is mahine" queries, use THIS_MONTH section.

3. CHART IN RESPONSE — A chart ${hasChart ? "HAS" : "has NOT"} been auto-generated with this response.
   ${hasChart
        ? `- Since a chart is already shown below your text, keep your text answer SHORT and FOCUSED.
   - ONE acknowledgement line only: "Neeche chart bhi dekh sakte ho 👇" (Hindi) or "Chart is shown below 👇" (English).
   - Then 3–5 bullet insights MAX. No lengthy descriptions of what the chart shows.
   - Total response: max 8 lines.`
        : `- No chart with this response. Give a complete text answer.
   - Use bullet points for 3+ item lists. Be concise but complete.`
    }

4. TONE: Warm, helpful. No alarming language. No judgment on spending habits.

5. SORTING: Monthly breakdowns always chronological (Jan → Dec).

6. MISSING MONTHS: Skip months with ₹0. Do not show empty entries.

7. COMPARISON FORMAT (year-vs-year or period comparisons):
   - Summary line first: total + count for each period.
   - Monthly breakdown chronologically.
   - Mark highest 🔝 lowest 🔽 (only if 3+ months).
   - One neutral closing observation.

8. GENERAL FORMAT:
   - Lead with direct answer, then detail.
   - No filler: no "Great question!", no "Based on your data...".
   - Emojis: only 📊 🔝 🔽 💰 ☕ and sparingly.`;

    const messages = [
        ...conversationHistory
            .filter((m) => m.role === "user" || m.role === "assistant")
            .slice(-8)
            .map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
        { role: "user" as const, content: userMessage },
    ];

    const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
            model: "claude-haiku-4-5-20251001",
            max_tokens: 800,
            system: systemPrompt,
            messages,
        }),
    });

    if (!response.ok) {
        const err = await response.text();
        console.error("Claude API error:", err);
        throw new Error("Claude API call failed");
    }

    const claudeData = await response.json();
    return (
        claudeData?.content
            ?.filter((block: any) => block.type === "text")
            .map((block: any) => block.text)
            .join("\n") || "Sorry, I couldn't process your request."
    );
}