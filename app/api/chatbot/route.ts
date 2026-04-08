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

        // ✅ Categories fetch
        const categoriesResult = await pool.query`
            SELECT ExpensedescTypeID, ExpenseTypeName
            FROM dbo.tbl_Exensedesctypes
            WHERE UserId = ${userId} AND IsDeleted = 0
        `;
        const activeCategories = categoriesResult.recordset.map((c: any) => c.ExpenseTypeName.trim());

        // ✅ Expenses fetch
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
        console.error(error);
        return NextResponse.json(
            { error: "Internal Server Error" },
            { status: 500, headers: corsHeaders }
        );
    }
}

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

async function callClaude(
    userMessage: string,
    summary: string,
    conversationHistory: { role: string; content: string }[] = []
): Promise<string> {
    const apiKey = process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
        console.error("ANTHROPIC_API_KEY is not set in environment variables");
        throw new Error("API key not configured");
    }

    const systemPrompt = `
You are a smart personal finance assistant.
You have access to the user's complete transaction data provided below.
Your job is to answer the user's question accurately using ONLY this data.

RULES:
1. **LANGUAGE RULE — MOST IMPORTANT:**
   - Check the user's message script/language FIRST before doing anything else.
   - If the message is written in English (Latin script, English words) → respond ONLY in English. No Hindi at all.
   - If the message is written in Hindi (Devanagari script) or Hinglish (Hindi words in Latin script like "kitna", "mera", "kharcha") → respond in Hindi.
   - The financial data in the summary is in English — that does NOT affect the response language. Only the USER'S message language matters.
   - STRICTLY mirror the user's language. Never switch languages on your own.
2. Use the EXACT numbers from the data. Never guess or make up values.
3. Keep responses concise, clear, and well-formatted with relevant emojis.
4. If the user asks something not covered by the data, politely say so.
5. For greetings like "hi", "hello", "namaste", "hii" → respond friendly and list what you can help with.
6. TODAY'S DATE and CURRENT MONTH are already provided in the data. 
   When user says "this month", "is mahine", "aaj ka", "abhi" — use THIS MONTH SUMMARY section directly.
   NEVER ask the user to clarify which month when they say "this month".
7. Category names in the data: salary = salary/income, Tea = tea expenses, Help fundd / test fundd = fund categories, Trip = travel.

USER'S TRANSACTION DATA:
${summary}
`.trim();

    // ✅ Conversation history properly format karo
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