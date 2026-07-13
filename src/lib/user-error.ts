const DATABASE_MESSAGES: Record<string, string> = {
  forbidden: "ليست لديك صلاحية لتنفيذ هذا الإجراء",
  authentication_required: "انتهت جلسة الدخول. سجّل الدخول مجددًا",
  invalid_request: "بيانات الطلب غير مكتملة أو غير صحيحة",
  idempotency_conflict:
    "تعارضت إعادة المحاولة مع طلب سابق. حدّث الصفحة ثم أعد المحاولة",
  worker_not_found: "العامل غير موجود أو لم يعد نشطًا",
  project_not_found: "المشروع غير موجود أو لم يعد نشطًا",
  active_project_not_found: "المشروع غير موجود أو مؤرشف",
  workspace_not_found: "مساحة العمل غير موجودة أو غير نشطة",
  module_disabled: "هذه الميزة غير مفعّلة في إعدادات المشروع",
  invalid_amount: "أدخل مبلغًا صحيحًا أكبر من صفر",
  invalid_daily_wage: "أدخل أجرًا يوميًا صحيحًا أكبر من صفر",
  invalid_project_name: "اكتب اسمًا واضحًا للمشروع",
  invalid_project_description: "وصف المشروع غير صالح أو أطول من اللازم",
  invalid_project_goal: "أدخل هدفًا ماليًا صحيحًا",
  invalid_project_type: "نوع المشروع غير مدعوم",
  invalid_project_modules: "إعدادات وحدات المشروع غير صحيحة",
  invalid_color_token: "لون المشروع غير مدعوم",
  invalid_opening_capital: "أدخل رأس مال افتتاحيًا أكبر من صفر",
  project_not_active: "يجب أن يكون المشروع نشطًا",
  client_id_required: "تعذر تأمين العملية. أعد المحاولة",
  invalid_capital_amount: "أدخل مبلغ رأس مال غير صفري",
  invalid_capital_sign: "اتجاه مبلغ رأس المال لا يطابق نوع الحركة",
  invalid_currency: "العملة المختارة غير متاحة",
  invalid_note: "الملاحظة أطول من الحد المسموح",
  invalid_inventory_name: "اكتب اسمًا واضحًا للصنف",
  invalid_inventory_quantity: "أدخل كمية صحيحة لا تقل عن صفر",
  invalid_unit_label: "اكتب وحدة قياس واضحة",
  invalid_unit_cost: "أدخل تكلفة وحدة صحيحة لا تقل عن صفر",
  inventory_item_not_found: "صنف المخزون غير موجود",
  inventory_item_archived: "هذا الصنف مؤرشف ولا يمكن تعديله",
  idempotency_state_missing: "تعذر التحقق من العملية. أعد المحاولة",
  idempotency_result_missing: "تعذر استعادة نتيجة العملية السابقة",
  idempotency_state_conflict:
    "تعارضت حالة العملية. حدّث الصفحة ثم أعد المحاولة",
  invalid_entry_type: "نوع حركة العامل غير مدعوم",
  insufficient_worker_balance: "رصيد العامل لا يكفي لهذه الحركة",
  wallet_required: "اختر محفظة السحب",
  "authentication required": "انتهت جلسة الدخول. سجّل الدخول مجددًا",
  "active workspace writer role required":
    "ليست لديك صلاحية الكتابة في مساحة العمل",
  "active workspace membership required":
    "عضويتك في مساحة العمل غير نشطة",
  "workspace writes are unavailable for the current entitlement":
    "الكتابة متوقفة لهذه المساحة. راجع حالة الاشتراك",
  "active workspace not found": "مساحة العمل غير موجودة أو غير نشطة",
  "active currency not found": "العملة المختارة غير متاحة",
  "wallet not found in workspace": "المحفظة غير موجودة في مساحة العمل",
  "source wallet not found in workspace": "محفظة المصدر غير موجودة",
  "destination wallet not found in workspace": "محفظة الاستلام غير موجودة",
  "wallet is not active": "المحفظة غير نشطة",
  "both transfer wallets must be active": "يجب أن تكون المحفظتان نشطتين",
  "source and destination wallets must be different":
    "اختر محفظتين مختلفتين",
  "transfer wallets must use the same currency":
    "يجب أن تستخدم المحفظتان العملة نفسها",
  "insufficient wallet funds": "الرصيد غير كافٍ لإتمام المعاملة",
  "insufficient source wallet funds": "رصيد محفظة المصدر غير كافٍ",
  "transaction amount must be positive": "أدخل مبلغًا أكبر من صفر",
  "transfer amount must be positive": "أدخل مبلغ تحويل أكبر من صفر",
  "opening balance must be zero or positive":
    "يجب ألا يكون الرصيد الافتتاحي سالبًا",
  "target balance must be zero or positive":
    "يجب ألا يكون الرصيد المستهدف سالبًا",
  "financial event not found in workspace": "المعاملة غير موجودة",
  "reversal events cannot be reversed": "لا يمكن حذف معاملة ملغاة",
  "financial event was already reversed": "تم حذف هذه المعاملة مسبقًا",
  "only income and expense transactions can be replaced":
    "يمكن تعديل الدخل والمصروف فقط",
  "reversal would overdraw a wallet":
    "لا يمكن حذف المعاملة لأن الرصيد سيصبح سالبًا",
  "project must be active and in the workspace":
    "المشروع غير موجود أو غير نشط",
  "project-linked transactions must use the workspace default currency":
    "اربط المشروع بمعاملة تستخدم العملة الأساسية لمساحة العمل",
  "debt direction is required": "اختر إن كان الدين مستحقًا لك أو عليك",
  "debt principal must be positive": "أدخل مبلغ دين أكبر من صفر",
  "debt party name must contain 1 to 160 characters":
    "اكتب اسمًا واضحًا للطرف",
  "debt party phone cannot exceed 50 characters":
    "رقم هاتف الطرف أطول من اللازم",
  "debt party notes cannot exceed 1000 characters":
    "ملاحظات الطرف أطول من اللازم",
  "debt note cannot exceed 1000 characters": "ملاحظة الدين أطول من اللازم",
  "active debt currency not found": "عملة الدين غير متاحة",
  "project-linked debts must use the workspace default currency":
    "الدين المرتبط بمشروع يجب أن يستخدم العملة الأساسية",
  "debt entry type must be payment, adjustment, or write_off":
    "نوع حركة الدين غير مدعوم",
  "debt entry amount cannot be zero": "مبلغ حركة الدين لا يمكن أن يكون صفرًا",
  "debt payments and write-offs must be negative":
    "تعذر تحديد اتجاه مبلغ السداد أو الشطب",
  "debt entry date is required": "اختر تاريخ حركة الدين",
  "debt entry note cannot exceed 1000 characters":
    "ملاحظة حركة الدين أطول من اللازم",
  "a wallet can only be linked to a debt payment":
    "يمكن ربط المحفظة بدفعة فقط",
  "debt not found in workspace": "الدين غير موجود",
  "closed debt cannot receive new entries":
    "هذا الدين مغلق ولا يقبل حركات جديدة",
  "debt entry cannot exceed the outstanding balance":
    "لا يمكن أن تتجاوز الحركة الرصيد المتبقي",
  "write-off must equal the full outstanding balance":
    "يجب أن يساوي الشطب كامل الرصيد المتبقي",
  "wallet currency must match debt currency":
    "اختر محفظة بعملة الدين نفسها",
  "wallet-backed debt payment is outside bigint range":
    "مبلغ الدفعة أكبر من النطاق المدعوم",
  debt_event_managed:
    "هذه المعاملة مرتبطة بدين. عدّلها من سجل الديون وليس من المعاملات",
  "Debt-linked wallet events must be managed through debt RPCs":
    "هذه المعاملة مرتبطة بدين. عدّلها من سجل الديون وليس من المعاملات",
  "category must be active, in the workspace, and match transaction kind":
    "التصنيف غير نشط أو لا يطابق نوع المعاملة",
  "idempotency key was already used with a different payload":
    "تعارضت إعادة المحاولة مع عملية سابقة. حدّث الصفحة ثم أعد المحاولة",
  "payment proof must be attached before approval":
    "يجب إرفاق إثبات الدفع قبل الموافقة",
  "payment request was already reviewed": "تمت مراجعة طلب الدفع مسبقًا",
  invalid_notification_target: "حدد مستلمًا صالحًا للإشعار",
  notification_target_mismatch:
    "المستخدم ليس عضوًا في مساحة العمل المحددة",
  invalid_notification_title: "عنوان الإشعار غير صالح أو أطول من اللازم",
  invalid_notification_body: "نص الإشعار غير صالح أو أطول من اللازم",
  invalid_notification_kind: "نوع الإشعار غير مدعوم",
  invalid_notification_metadata: "بيانات الإشعار الإضافية غير صالحة",
  onboarding_intent_expired: "انتهت صلاحية رابط تفعيل الحساب. اطلب رابطًا جديدًا",
  onboarding_intent_conflict:
    "يوجد طلب تفعيل قائم لهذا البريد. ألغِه أو انتظر انتهاءه ثم أعد المحاولة",
  invalid_subscription_transition: "انتقال حالة الاشتراك غير مسموح",
  inactive_plan: "الخطة غير متاحة أو غير نشطة",
  invalid_plan_interval: "مدة الخطة غير صالحة",
  must_change_password: "يجب تغيير كلمة المرور قبل المتابعة",
};

export function getUserErrorMessage(
  error: { message?: string } | Error | null | unknown,
  fallback: string,
): string {
  const raw =
    error && typeof error === "object" && "message" in error
      ? String(error.message).trim()
      : "";
  if (!raw) return fallback;

  const normalized = raw.toLocaleLowerCase("en-US");
  const exact = DATABASE_MESSAGES[normalized];
  if (exact) return exact;

  if (
    normalized.includes("failed to fetch") ||
    normalized.includes("network") ||
    normalized.includes("load failed")
  ) {
    return "تعذر الاتصال بالخادم. تحقق من الإنترنت ثم أعد المحاولة";
  }
  if (
    normalized.includes("jwt") ||
    normalized.includes("token has expired")
  ) {
    return "انتهت جلسة الدخول. سجّل الدخول مجددًا";
  }
  if (
    normalized.includes("permission denied") ||
    normalized.includes("row-level security")
  ) {
    return "ليست لديك صلاحية لتنفيذ هذا الإجراء";
  }
  if (/[\u0600-\u06ff]/u.test(raw)) return raw;

  return fallback;
}
