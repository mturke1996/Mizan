import {
  Bell,
  BriefcaseBusiness,
  ChartNoAxesCombined,
  FileBarChart2,
  FileText,
  FolderKanban,
  House,
  PiggyBank,
  Plus,
  ReceiptText,
  Scale,
  Search,
  Settings,
  ShieldCheck,
  Users,
  WalletCards,
  X,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/features/auth/use-auth";

interface CommandItem {
  id: string;
  label: string;
  category: "navigation" | "actions";
  icon: LucideIcon;
  to?: string;
  action?: () => void;
  keywords?: string[];
}

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenChange(!open);
      } else if (e.key === "Escape" && open) {
        onOpenChange(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onOpenChange]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  if (!open) return null;

  const items: CommandItem[] = [
    // Quick Actions
    {
      id: "action-new-expense",
      label: "تسجيل مصروف جديد",
      category: "actions",
      icon: Plus,
      action: () => navigate("/transactions/new?type=expense"),
      keywords: ["مصروف", "صرف", "دفع", "إضافة"],
    },
    {
      id: "action-new-income",
      label: "تسجيل دخل جديد",
      category: "actions",
      icon: Plus,
      action: () => navigate("/transactions/new?type=income"),
      keywords: ["دخل", "قبض", "إيراد", "إضافة"],
    },
    {
      id: "action-new-debt",
      label: "تسجيل دين / مستحق جديد",
      category: "actions",
      icon: Scale,
      action: () => navigate("/debts/new"),
      keywords: ["دين", "قرض", "سلف", "مستحق"],
    },
    {
      id: "action-new-invoice",
      label: "إنشاء فاتورة جديدة",
      category: "actions",
      icon: FileText,
      action: () => navigate("/invoices/new"),
      keywords: ["فاتورة", "تحصيل", "عميل"],
    },
    // Navigation
    {
      id: "nav-home",
      label: "لوحة الملخص الرئيسية",
      category: "navigation",
      icon: House,
      to: "/",
      keywords: ["الرئيسية", "ملخص", "dashboard"],
    },
    {
      id: "nav-transactions",
      label: "سجل المعاملات",
      category: "navigation",
      icon: ReceiptText,
      to: "/transactions",
      keywords: ["معاملات", "حركات", "مصاريف"],
    },
    {
      id: "nav-wallets",
      label: "المحافظ والحسابات",
      category: "navigation",
      icon: WalletCards,
      to: "/wallets",
      keywords: ["محفظة", "بنك", "حساب"],
    },
    {
      id: "nav-income",
      label: "مصادر الدخل",
      category: "navigation",
      icon: BriefcaseBusiness,
      to: "/income",
      keywords: ["دخل", "مرتب", "أرباح"],
    },
    {
      id: "nav-debts",
      label: "سجل الديون والالتزامات",
      category: "navigation",
      icon: Scale,
      to: "/debts",
      keywords: ["ديون", "مستحقات"],
    },
    {
      id: "nav-invoices",
      label: "الفواتير والتحصيل",
      category: "navigation",
      icon: FileText,
      to: "/invoices",
      keywords: ["فواتير"],
    },
    {
      id: "nav-projects",
      label: "المشاريع والأعمال",
      category: "navigation",
      icon: FolderKanban,
      to: "/projects",
      keywords: ["مشروع", "مشاريع"],
    },
    {
      id: "nav-clients",
      label: "دليل العملاء",
      category: "navigation",
      icon: Users,
      to: "/clients",
      keywords: ["عملاء", "زبائن"],
    },
    {
      id: "nav-analytics",
      label: "التحليلات والمؤشرات",
      category: "navigation",
      icon: ChartNoAxesCombined,
      to: "/analytics",
      keywords: ["تحليل", "إحصائيات"],
    },
    {
      id: "nav-reports",
      label: "التقارير والتصدير",
      category: "navigation",
      icon: FileBarChart2,
      to: "/reports",
      keywords: ["تقرير", "pdf", "excel"],
    },
    {
      id: "nav-budgets",
      label: "الميزانيات والسقوف",
      category: "navigation",
      icon: PiggyBank,
      to: "/budgets",
      keywords: ["ميزانية", "سقف"],
    },
    {
      id: "nav-notifications",
      label: "مركز الإشعارات",
      category: "navigation",
      icon: Bell,
      to: "/notifications",
      keywords: ["إشعارات", "تنبيهات"],
    },
    {
      id: "nav-settings",
      label: "إعدادات الحساب",
      category: "navigation",
      icon: Settings,
      to: "/settings",
      keywords: ["إعدادات", "حساب", "ملف"],
    },
  ];

  if (profile?.system_role === "supervisor") {
    items.push({
      id: "nav-supervisor",
      label: "مركز إدارة المنصة (Supervisor)",
      category: "navigation",
      icon: ShieldCheck,
      to: "/supervisor",
      keywords: ["إدارة", "إشراف", "supervisor"],
    });
  }

  const cleanQuery = query.trim().toLowerCase();
  const filtered = cleanQuery
    ? items.filter(
        (item) =>
          item.label.toLowerCase().includes(cleanQuery) ||
          item.keywords?.some((k) => k.toLowerCase().includes(cleanQuery)),
      )
    : items;

  function handleSelect(item: CommandItem) {
    onOpenChange(false);
    if (item.action) {
      item.action();
    } else if (item.to) {
      navigate(item.to);
    }
  }

  return (
    <div
      dir="rtl"
      className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4 bg-ink/40 backdrop-blur-sm animate-fade-in"
      onClick={() => onOpenChange(false)}
    >
      <div
        className="w-full max-w-xl rounded-2xl border border-line bg-surface shadow-2xl overflow-hidden animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-line px-4 py-3.5">
          <Search size={18} className="text-muted shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ابحث عن قسم أو إجراء سريعة… (Ctrl+K)"
            className="flex-1 bg-transparent text-sm font-semibold text-ink placeholder:text-muted focus:outline-none"
          />
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="pressable grid size-7 place-items-center rounded-lg hover:bg-surface-subtle text-muted"
            aria-label="إغلاق"
          >
            <X size={16} />
          </button>
        </div>

        <div className="max-h-96 overflow-y-auto p-2 subtle-scrollbar">
          {filtered.length === 0 ? (
            <div className="py-8 text-center text-sm font-semibold text-muted">
              لا توجد نتائج تطابق «{query}»
            </div>
          ) : (
            <ul className="space-y-1">
              {filtered.map((item) => {
                const Icon = item.icon;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => handleSelect(item)}
                      className="pressable flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-right text-xs font-bold text-ink hover:bg-primary-soft hover:text-primary transition-colors"
                    >
                      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-surface-subtle text-muted group-hover:text-primary">
                        <Icon size={16} />
                      </span>
                      <span className="flex-1 truncate">{item.label}</span>
                      <span className="text-[10px] font-semibold text-soft">
                        {item.category === "actions" ? "إجراء" : "انتقال"}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-line px-4 py-2 text-[11px] font-semibold text-muted bg-surface-subtle/50">
          <span>استخدم الأسهم أو الماوس للاختيار</span>
          <span className="font-mono text-[10px] rounded bg-surface px-1.5 py-0.5 border border-line">
            Esc للإغلاق
          </span>
        </div>
      </div>
    </div>
  );
}
