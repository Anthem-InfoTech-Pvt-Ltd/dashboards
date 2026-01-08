// app/dashboard/layout.tsx
import DashboardLayout from "@/components/dashboard-layout";
import { cookies } from "next/headers";
import jwt from "jsonwebtoken";
import { sql, config } from "@/lib/db";
import { redirect } from "next/navigation";

export default async function DashboardRootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = cookies();
  const email = cookieStore.get("user_email")?.value?.trim();
  const accessToken = cookieStore.get("access_token")?.value;

  if (!email) {
    return redirect("/signin");
  }

  const pool = await sql.connect(config);
  const userResult = await pool.query`
    SELECT TOP 1 *
    FROM [dbo].[tblUsers]
    WHERE LOWER([EmailId]) = ${email.toLowerCase()}
  `;
  
  const dbUser = userResult.recordset?.[0];

  if (!dbUser) {
    return redirect("/signin");
  }

  const user = {
    userId: dbUser.UserId,
    email: dbUser.EmailId,
    fullName: dbUser.FullName,
    profileImage: dbUser.ProfileImage,
    token: accessToken || null,
  };

  if (accessToken?.startsWith("ey")) {
    try {
      const decoded = jwt.decode(accessToken) as any;
      if (decoded) {
        user.fullName = decoded.name || user.fullName;
        user.profileImage = decoded.picture || user.profileImage;
        user.email = decoded.email || user.email;
      }
    } catch {}
  }

  // You can pass user to a provider or props here if needed
  return <DashboardLayout>{children}</DashboardLayout>;
}