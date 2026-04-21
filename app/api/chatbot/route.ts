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
            data,
            currency,
            activeCategories,
            currentMonth,
            currentYear,
            currentMonthName,
            currentDate
        );

        const claudeReply = await callClaude(message, summary, conversationHistory);

        return NextResponse.json(
            { reply: claudeReply },
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

// ==================== BUILD SUMMARY ====================
function buildSummary(
    data: any[],
    currency: string,
    activeCategories: string[],
    currentMonth: number,
    currentYear: number,
    currentMonthName: string,
    currentDate: string
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

    // Overall category map
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

    // Recent 5 transactions (compact)
    const recent5 = [...data]
        .reverse()
        .slice(0, 5)
        .map((e) =>
            `${new Date(e.Date).toLocaleDateString("en-GB")} ${e.ExpenseType} ${currency}${Number(e.Expenses).toLocaleString()} [${e.ExpenseDescType || e.Description}]`
        )
        .join("\n");

    // Overall category breakdown (compact)
    const categoryLines = Object.entries(categoryMap)
        .sort((a, b) => (b[1].debit + b[1].credit) - (a[1].debit + a[1].credit))
        .map(([cat, val]) =>
            `${cat}: Dr${currency}${val.debit.toLocaleString()} Cr${currency}${val.credit.toLocaleString()} (${val.count})`
        )
        .join("\n");

    // This month transactions (compact)
    const thisMonthLines =
        thisMonthData.length > 0
            ? thisMonthData
                .map((e) =>
                    `${new Date(e.Date).toLocaleDateString("en-GB")} ${e.ExpenseType} ${currency}${Number(e.Expenses).toLocaleString()} [${e.ExpenseDescType || e.Description}]`
                )
                .join("\n")
            : `No transactions in ${currentMonthName} ${currentYear}.`;

    // ── MONTH × CATEGORY BREAKDOWN (compact format) ──
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

    // Format: "2024-03|Tea:Dr2890(6),Water:Dr440(2)"  — very compact to save tokens
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
                })
                .join(",");
            return `${key}|${catStr}`;
        })
        .join("\n");

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
    conversationHistory: { role: string; content: string }[] = []
): Promise<string> {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("API key not configured");

    const systemPrompt = `You are a precise personal finance assistant with COMPLETE access to the user's transaction history.

<data>
${summary}
</data>

RULES:
1. LANGUAGE: Mirror user — English→English, Hindi/Hinglish→Hindi.
2. You have ALL data for ALL months and categories. NEVER say data is unavailable.
3. For month-wise category queries (e.g. "highest tea month"), scan MONTH_CATEGORY rows, find that category's Dr amount per month, return the highest.
4. MONTH_CATEGORY format: YYYY-MM|Category:DrAmount+CrAmount(count)
5. For "this month/is mahine" use THIS_MONTH section.
6. Be concise, use emojis. Category hints: salary=Income, Tea=Tea expense.`;

    const messages = [
        ...conversationHistory
            .filter((m) => m.role === "user" || m.role === "assistant")
            .slice(-8) // keep last 8 messages only
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