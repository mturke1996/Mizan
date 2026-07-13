import {
  BriefcaseBusiness,
  ChartNoAxesCombined,
  Scale,
  ShieldCheck,
} from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";

interface AuthLayoutProps {
  title: string;
  description: string;
  children: ReactNode;
  footer?: ReactNode;
}

const benefits = [
  {
    icon: ChartNoAxesCombined,
    title: "قرارات أوضح",
    description: "معدلات واتجاهات محسوبة من معاملاتك الفعلية.",
  },
  {
    icon: BriefcaseBusiness,
    title: "مشاريع وعمال",
    description: "دخل ومصروف ويوميات وسحوبات في سجل واحد.",
  },
  {
    icon: ShieldCheck,
    title: "خصوصية محكمة",
    description: "كل مساحة عمل معزولة بصلاحيات قاعدة البيانات.",
  },
] as const;

export function AuthLayout({
  title,
  description,
  children,
  footer,
}: AuthLayoutProps) {
  return (
    <main className="min-h-dvh bg-surface lg:flex lg:items-center lg:bg-canvas lg:px-6 lg:py-6">
      <div className="mx-auto grid min-h-dvh w-full bg-surface lg:min-h-[680px] lg:max-w-6xl lg:overflow-hidden lg:rounded-[14px] lg:border lg:border-line lg:shadow-[0_20px_60px_rgb(27_30_60/7%)] lg:grid-cols-[0.92fr_1.08fr]">
        <aside className="relative hidden overflow-hidden bg-auth-panel p-10 text-white lg:flex lg:flex-col lg:justify-between">
          <Link
            to="/auth/login"
            className="relative inline-flex w-fit items-center gap-3 rounded-sm focus-visible:outline-white"
            aria-label="ميزان، تسجيل الدخول"
          >
            <span className="grid size-11 place-items-center rounded-sm bg-white/12 shadow-inner shadow-white/10">
              <Scale className="size-6" strokeWidth={1.8} aria-hidden="true" />
            </span>
            <span className="text-xl font-bold">ميزان</span>
          </Link>

          <div className="relative my-12">
            <p className="max-w-md text-[38px] leading-[1.35] font-bold tracking-[-0.035em] text-balance">
              اعرف أين يذهب مالك، وما الذي ينمو فعلاً.
            </p>
            <p className="mt-4 max-w-sm text-sm leading-7 text-white/72">
              مساحة مالية عربية تجمع المحافظ والمشاريع والعمل اليومي في صورة
              دقيقة وسهلة.
            </p>
          </div>

          <ul className="relative divide-y divide-white/10 border-y border-white/10">
            {benefits.map(({ icon: Icon, title: itemTitle, description: itemDescription }) => (
              <li
                key={itemTitle}
                className="grid grid-cols-[40px_1fr] gap-3 py-3.5"
              >
                <span className="grid size-10 place-items-center rounded-sm bg-white/10">
                  <Icon className="size-5" strokeWidth={1.8} aria-hidden="true" />
                </span>
                <span>
                  <span className="block text-sm font-bold">{itemTitle}</span>
                  <span className="mt-1 block text-xs leading-5 text-white/68">
                    {itemDescription}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </aside>

        <section className="flex min-h-dvh flex-col justify-center px-5 py-8 sm:px-10 lg:min-h-0 lg:p-14">
          <Link
            to="/auth/login"
            className="mb-10 inline-flex w-fit items-center gap-2 text-primary lg:hidden"
            aria-label="ميزان، تسجيل الدخول"
          >
            <span className="grid size-10 place-items-center rounded-sm bg-primary-soft">
              <Scale className="size-5" strokeWidth={1.8} aria-hidden="true" />
            </span>
            <span className="font-bold text-ink">ميزان</span>
          </Link>

          <div className="w-full max-w-md self-center">
            <header className="mb-8">
              <h1 className="text-[29px] leading-[1.3] font-bold tracking-[-0.03em] text-ink text-balance sm:text-[34px]">
                {title}
              </h1>
              <p className="mt-3 max-w-[42ch] text-sm leading-6 text-muted">
                {description}
              </p>
            </header>

            {children}

            {footer ? (
              <div className="mt-7 text-center text-sm text-muted">{footer}</div>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}
