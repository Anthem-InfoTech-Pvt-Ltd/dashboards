import { NextResponse } from "next/server";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import nodemailer from "nodemailer";
import { sql } from "@/lib/db";

export async function GET() {
  try {
    const pool = await sql.connect();

    const usersResult = await pool.request().query(`
      SELECT UserId, FullName, EmailId, ExpensereportEmail, CCEmailAddress
      FROM tblUsers
      WHERE IsDeleted = 0
    `);

    const users = usersResult.recordset;

    // 🔥 START BACKGROUND TASK
    setImmediate(async () => {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_SERVER,
        port: Number(process.env.SMTP_PORT),
        secure: false,
        auth: {
          user: process.env.SMTP_USERNAME,
          pass: process.env.SMTP_PASSWORD,
        },
        connectionTimeout: 60_000,
      });

      for (const user of users) {
        try {
          const toEmail =
            user.ExpensereportEmail?.trim() || user.EmailId?.trim();
          if (!toEmail) continue;

          const expenseResult = await pool.request().query(`
            SELECT *
            FROM tbl_Expenses
            WHERE UserId = ${user.UserId}
              AND IsDeleted = 0
            ORDER BY [Date] DESC
          `);

          if (!expenseResult.recordset.length) continue;

          const doc = new jsPDF({ unit: "pt" });
          doc.text(`Expense Report - ${user.FullName}`, 40, 40);

          autoTable(doc, {
            startY: 70,
            head: [["Date", "Description", "Category", "Amount"]],
            body: expenseResult.recordset.map((e: any) => [
              new Date(e.Date).toLocaleDateString(),
              e.Description || "-",
              e.ExpenseDescType || "-",
              e.Expenses,
            ]),
            styles: { fontSize: 9 },
          });

          const pdfBuffer = Buffer.from(doc.output("arraybuffer"));

          await transporter.sendMail({
            from: `"${process.env.SMTP_SENDER_NAME}" <${process.env.SMTP_SENDER_EMAIL}>`,
            to: toEmail,
            cc: user.CCEmailAddress || undefined,
            subject: "Your Expense Report",
            text: `Hello ${user.FullName}, please find your expense report attached.`,
            attachments: [
              { filename: "Expense-Report.pdf", content: pdfBuffer },
            ],
          });

          // 🧠 throttle (VERY IMPORTANT)
          await new Promise(r => setTimeout(r, 1500));
        } catch (err) {
          console.error("Mail failed for user:", user.UserId, err);
        }
      }
    });

    // ✅ IMMEDIATE RESPONSE
    return NextResponse.json({
      success: true,
      message: "Expense email job started in background",
    });
  } catch (error: any) {
    console.error("API ERROR 👉", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}