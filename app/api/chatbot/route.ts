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

        // ✅ Auth: pehle cookie check karo, phir userId from body
        const cookieStore = await cookies();
        const email = cookieStore.get("user_email")?.value?.trim();

        let userId: number | null = null;
        let currency = "₹";

        const pool = await sql.connect(config);

        if (email) {
            // Next.js app — cookie se user dhundo
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
            // React app — userId directly from request body
            userId = body.userId;

            const userResult = await pool.query`
                SELECT Currency
                FROM [dbo].[tblUsers]
                WHERE UserId = ${userId}
            `;
            const user = userResult.recordset?.[0];
            if (user) {
                currency = user.Currency === "USD" ? "$" : "₹";
            }

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

        // ✅ Fetch Active Categories
        const categoriesResult = await pool.query`
            SELECT ExpensedescTypeID, ExpenseTypeName
            FROM dbo.tbl_Exensedesctypes
            WHERE UserId = ${userId} AND IsDeleted = 0
        `;
        const activeCategories = categoriesResult.recordset.map((c: any) => c.ExpenseTypeName.trim());

        // ✅ Fetch All Expenses
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

        // Build both summaries
        const humanReadableSummary = buildSummary(
            data,
            currency,
            activeCategories,
            currentMonth,
            currentYear,
            currentMonthName,
            currentDate
        );

        const structuredDataJson = buildStructuredData(data, activeCategories, currency);

        const claudeReply = await callClaude(
            message, 
            humanReadableSummary, 
            structuredDataJson, 
            conversationHistory
        );

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

// ==================== BUILD HUMAN-READABLE SUMMARY ====================
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
    const oldest = data[0];
    const newest = [...data].reverse()[0];
    const highest = data.reduce((max, curr) =>
        Number(curr.Expenses) > Number(max.Expenses) ? curr : max
    );
    const lowest = data.reduce((min, curr) =>
        Number(curr.Expenses) < Number(min.Expenses) ? curr : min
    );
    const latestBalance = newest?.Balance ?? balance;

    const recent5 = [...data]
        .reverse()
        .slice(0, 5)
        .map(
            (e) =>
                `- ${new Date(e.Date).toLocaleDateString("en-GB")}: ${currency}${Number(e.Expenses).toLocaleString()} | ${e.ExpenseType} | ${e.ExpenseDescType || e.Description}`
        )
        .join("\n");

    const categoryLines = Object.entries(categoryMap)
        .sort((a, b) => (b[1].credit + b[1].debit) - (a[1].credit + a[1].debit))
        .map(
            ([cat, val]) =>
                `- ${cat}: Credit ${currency}${val.credit.toLocaleString()}, Debit ${currency}${val.debit.toLocaleString()}, Count: ${val.count}`
        )
        .join("\n");

    const thisMonthLines =
        thisMonthData.length > 0
            ? thisMonthData
                .map(
                    (e) =>
                        `- ${new Date(e.Date).toLocaleDateString("en-GB")}: ${currency}${Number(e.Expenses).toLocaleString()} | ${e.ExpenseType} | ${e.ExpenseDescType || e.Description}`
                )
                .join("\n")
            : `No transactions in ${currentMonthName} ${currentYear}.`;

    return `
=== USER FINANCIAL DATA ===
Currency: ${currency}
Total Transactions: ${data.length}

TODAY'S DATE: ${currentDate}
CURRENT MONTH: ${currentMonthName} ${currentYear}

THIS MONTH SUMMARY (${currentMonthName} ${currentYear}):
- Total Credit This Month: ${currency}${thisMonthCredit.toLocaleString()}
- Total Debit This Month: ${currency}${thisMonthDebit.toLocaleString()}
- Net This Month: ${currency}${(thisMonthCredit - thisMonthDebit).toLocaleString()}
- Transactions Count This Month: ${thisMonthData.length}

THIS MONTH TRANSACTIONS:
${thisMonthLines}

OVERALL SUMMARY (All Time):
- Total Credit: ${currency}${totalCredit.toLocaleString()}
- Total Debit: ${currency}${totalDebit.toLocaleString()}
- Net Balance (Cr - Dr): ${currency}${balance.toLocaleString()}
- Latest Balance (from DB): ${currency}${Number(latestBalance).toLocaleString()}

OLDEST TRANSACTION:
- Date: ${new Date(oldest.Date).toLocaleDateString("en-GB")}
- Amount: ${currency}${Number(oldest.Expenses).toLocaleString()}
- Category: ${oldest.ExpenseDescType || oldest.Description}
- Type: ${oldest.ExpenseType}

LATEST TRANSACTION:
- Date: ${new Date(newest.Date).toLocaleDateString("en-GB")}
- Amount: ${currency}${Number(newest.Expenses).toLocaleString()}
- Category: ${newest.ExpenseDescType || newest.Description}
- Type: ${newest.ExpenseType}

HIGHEST TRANSACTION:
- Date: ${new Date(highest.Date).toLocaleDateString("en-GB")}
- Amount: ${currency}${Number(highest.Expenses).toLocaleString()}
- Category: ${highest.ExpenseDescType || highest.Description}
- Type: ${highest.ExpenseType}

LOWEST TRANSACTION:
- Date: ${new Date(lowest.Date).toLocaleDateString("en-GB")}
- Amount: ${currency}${Number(lowest.Expenses).toLocaleString()}
- Category: ${lowest.ExpenseDescType || lowest.Description}
- Type: ${lowest.ExpenseType}

RECENT 5 TRANSACTIONS:
${recent5}

CATEGORY-WISE BREAKDOWN (All Time):
${categoryLines}
`.trim();
}

// ==================== BUILD STRUCTURED DATA FOR AI (NEW) ====================
function buildStructuredData(data: any[], activeCategories: string[], currency: string): string {
    const yearsMap = new Map<number, any>();

    data.forEach((e: any) => {
        const date = new Date(e.Date);
        const year = date.getFullYear();

        if (!yearsMap.has(year)) {
            yearsMap.set(year, {
                year,
                categories: [],
                expenses: []
            });
        }

        const yearObj = yearsMap.get(year)!;

        const rawCat = (e.ExpenseDescType || e.Description || "Other").trim();
        const categoryName = activeCategories.includes(rawCat) ? rawCat : "Other";

        // Add category if not already present
        if (!yearObj.categories.some((c: any) => c.categoryName === categoryName)) {
            yearObj.categories.push({
                categoryName,
                type: e.ExpenseType === "Cr." ? "Cr" : "Dr"
            });
        }

        yearObj.expenses.push({
            expenseId: e.ExpenseId,
            amount: Number(e.Expenses),
            description: (e.Description || "").trim(),
            category: categoryName,
            type: e.ExpenseType === "Cr." ? "Cr" : "Dr",
            date: date.toISOString().split("T")[0], // YYYY-MM-DD
            balanceAfter: Number(e.Balance)
        });
    });

    // Sort years descending + expenses by date inside each year
    const years = Array.from(yearsMap.values())
        .sort((a, b) => b.year - a.year)
        .map((y) => {
            y.expenses.sort((a: any, b: any) => 
                new Date(a.date).getTime() - new Date(b.date).getTime()
            );
            return y;
        });

    const structured = {
        currency,
        totalTransactions: data.length,
        years
    };

    return JSON.stringify(structured, null, 2);
}

// ==================== CALL CLAUDE ====================
async function callClaude(
    userMessage: string,
    humanReadableSummary: string,
    structuredDataJson: string,
    conversationHistory: { role: string; content: string }[] = []
): Promise<string> {
    const apiKey = process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
        console.error("ANTHROPIC_API_KEY is not set");
        throw new Error("API key not configured");
    }

    const systemPrompt = `
You are a smart and precise personal finance assistant.

<structured_financial_data>
${structuredDataJson}
</structured_financial_data>

<human_readable_summary>
${humanReadableSummary}
</human_readable_summary>

RULES (Follow strictly):
1. LANGUAGE RULE:
   - If the user's message is in English → respond ONLY in English.
   - If the user's message is in Hindi or Hinglish → respond in Hindi.
   - Mirror the user's language exactly.

2. Use ONLY the data provided above. Never guess amounts, dates, or balances.

3. Be concise, clear, and helpful. Use relevant emojis.

4. For "this month", "is mahine", "aaj", "abhi" — use the THIS MONTH SUMMARY section.

5. Common category meanings:
   - "salary" = Income / Salary
   - "Tea" / "tea" = Tea expenses
   - "Help fundd" = Help / Fund transfer

Answer the user's question accurately using the provided data.
`.trim();

    const messages = [
        ...conversationHistory
            .filter((m) => m.role === "user" || m.role === "assistant")
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
            model: "claude-sonnet-4-20250514",
            max_tokens: 1000,
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

    const reply =
        claudeData?.content
            ?.filter((block: any) => block.type === "text")
            .map((block: any) => block.text)
            .join("\n") || "Sorry, I couldn't process your request.";

    return reply;
}