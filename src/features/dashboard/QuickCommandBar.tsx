import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { Link, useNavigate } from "react-router-dom";
import {
  Search,
  Plus,
  FileText,
  Scale,
  FolderKanban,
} from "lucide-react";

const autoSuggestions = [
  "إضافة معاملة دخل جديدة",
  "تسجيل مصروف تشغيلي للمشروع",
  "إنشاء فاتورة مبيعات للعميل",
  "سداد مستحق دين أو تحصيل",
  "تحويل بين المحافظ المالية",
];

export function QuickCommandBar() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [suggestionIndex, setSuggestionIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setSuggestionIndex((prev) => (prev + 1) % autoSuggestions.length);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && searchTerm.trim()) {
      navigate(`/transactions/new?query=${encodeURIComponent(searchTerm)}`);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 100, damping: 20, delay: 0.15 }}
      className="relative overflow-hidden rounded-[24px] border border-line bg-surface p-5 backdrop-blur-md shadow-card md:p-6"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Search Input Bar */}
        <div className="relative flex-1">
          <div className="pointer-events-none absolute inset-y-0 start-0 flex items-center ps-4 text-primary">
            <Search size={18} strokeWidth={2} />
          </div>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`بحث سريع أو تنفيذ أمر: "${autoSuggestions[suggestionIndex]}"`}
            className="w-full rounded-2xl border border-line bg-surface-subtle py-3.5 ps-11 pe-24 text-sm font-semibold text-ink placeholder-muted outline-none ring-2 ring-transparent transition-all focus:border-primary/50 focus:ring-primary/20"
          />
          <div className="absolute inset-y-1.5 end-1.5 flex items-center">
            <Link
              to="/transactions/new"
              className="flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-on shadow-md transition-transform hover:scale-105 active:scale-95"
            >
              <Plus size={15} strokeWidth={2.5} />
              <span>إضافة</span>
            </Link>
          </div>
        </div>

        {/* Quick Shortcut Actions Grid */}
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/invoices/new"
            className="flex items-center gap-2 rounded-xl border border-line bg-surface-subtle px-3 py-2.5 text-xs font-bold text-ink transition-colors hover:border-primary/40 hover:bg-surface-raised"
          >
            <FileText size={16} className="text-primary" />
            <span>فاتورة جديدة</span>
          </Link>
          <Link
            to="/debts"
            className="flex items-center gap-2 rounded-xl border border-line bg-surface-subtle px-3 py-2.5 text-xs font-bold text-ink transition-colors hover:border-primary/40 hover:bg-surface-raised"
          >
            <Scale size={16} className="text-warning" />
            <span>الديون والتحصيل</span>
          </Link>
          <Link
            to="/projects"
            className="flex items-center gap-2 rounded-xl border border-line bg-surface-subtle px-3 py-2.5 text-xs font-bold text-ink transition-colors hover:border-primary/40 hover:bg-surface-raised"
          >
            <FolderKanban size={16} className="text-primary" />
            <span>إدارة المشاريع</span>
          </Link>
        </div>
      </div>
    </motion.div>
  );
}
