import { getUserErrorMessage } from "./user-error";

describe("getUserErrorMessage", () => {
  it("translates known database errors into actionable Arabic", () => {
    expect(
      getUserErrorMessage(
        { message: "insufficient source wallet funds" },
        "تعذر التحويل",
      ),
    ).toBe("رصيد محفظة المصدر غير كافٍ");
  });

  it("does not expose unknown database internals", () => {
    expect(
      getUserErrorMessage(
        { message: 'relation "private.secret" does not exist' },
        "تعذر تحميل البيانات",
      ),
    ).toBe("تعذر تحميل البيانات");
  });

  it("explains disabled project modules without leaking RPC details", () => {
    expect(
      getUserErrorMessage({ message: "module_disabled" }, "تعذر الحفظ"),
    ).toBe("هذه الميزة غير مفعّلة في إعدادات المشروع");
  });

  it("preserves deliberate Arabic validation messages", () => {
    expect(
      getUserErrorMessage(
        { message: "أدخل مبلغًا أكبر من صفر" },
        "تعذر الحفظ",
      ),
    ).toBe("أدخل مبلغًا أكبر من صفر");
  });

  it("translates debt balance and currency errors", () => {
    expect(
      getUserErrorMessage(
        { message: "debt entry cannot exceed the outstanding balance" },
        "تعذر الحفظ",
      ),
    ).toBe("لا يمكن أن تتجاوز الحركة الرصيد المتبقي");
    expect(
      getUserErrorMessage(
        { message: "wallet currency must match debt currency" },
        "تعذر الحفظ",
      ),
    ).toBe("اختر محفظة بعملة الدين نفسها");
    expect(
      getUserErrorMessage(
        { message: "closed debt cannot receive new entries" },
        "تعذر الحفظ",
      ),
    ).toBe("هذا الدين مغلق ولا يقبل حركات جديدة");
    expect(
      getUserErrorMessage({ message: "debt_event_managed" }, "تعذر الحذف"),
    ).toBe(
      "هذه المعاملة مرتبطة بدين. عدّلها من سجل الديون وليس من المعاملات",
    );
  });

  it("translates supervisor notification validation errors", () => {
    expect(
      getUserErrorMessage(
        { message: "notification_target_mismatch" },
        "تعذر إرسال الإشعار",
      ),
    ).toBe("المستخدم ليس عضوًا في مساحة العمل المحددة");
    expect(
      getUserErrorMessage(
        { message: "invalid_notification_title" },
        "تعذر إرسال الإشعار",
      ),
    ).toBe("عنوان الإشعار غير صالح أو أطول من اللازم");
    expect(
      getUserErrorMessage(
        { message: "invalid_notification_body" },
        "تعذر إرسال الإشعار",
      ),
    ).toBe("نص الإشعار غير صالح أو أطول من اللازم");
    expect(
      getUserErrorMessage(
        { message: "invalid_notification_target" },
        "تعذر إرسال الإشعار",
      ),
    ).toBe("حدد مستلمًا صالحًا للإشعار");
  });

  it("translates project cash overdraft transfer errors", () => {
    expect(
      getUserErrorMessage(
        { message: "insufficient_project_cash" },
        "تعذر التحويل",
      ),
    ).toBe("رصيد خزينة المشروع لا يكفي للتحويل إلى المحفظة");
    expect(
      getUserErrorMessage({ message: "project_cash_disabled" }, "تعذر التسجيل"),
    ).toBe("خزينة المشروع معطّلة. فعّلها من إعدادات المشروع");
  });

  it("translates supervisor onboarding and subscription control-plane errors", () => {
    expect(
      getUserErrorMessage({ message: "forbidden" }, "تعذر التنفيذ"),
    ).toBe("ليست لديك صلاحية لتنفيذ هذا الإجراء");
    expect(
      getUserErrorMessage(
        { message: "onboarding_intent_expired" },
        "تعذر التفعيل",
      ),
    ).toBe("انتهت صلاحية رابط تفعيل الحساب. اطلب رابطًا جديدًا");
    expect(
      getUserErrorMessage(
        { message: "onboarding_intent_conflict" },
        "تعذر التفعيل",
      ),
    ).toBe(
      "يوجد طلب تفعيل قائم لهذا البريد. ألغِه أو انتظر انتهاءه ثم أعد المحاولة",
    );
    expect(
      getUserErrorMessage(
        { message: "invalid_subscription_transition" },
        "تعذر تحديث الاشتراك",
      ),
    ).toBe("انتقال حالة الاشتراك غير مسموح");
    expect(
      getUserErrorMessage({ message: "inactive_plan" }, "تعذر التفعيل"),
    ).toBe("الخطة غير متاحة أو غير نشطة");
    expect(
      getUserErrorMessage(
        { message: "invalid_plan_interval" },
        "تعذر التفعيل",
      ),
    ).toBe("مدة الخطة غير صالحة");
    expect(
      getUserErrorMessage(
        { message: "idempotency_conflict" },
        "تعذر التنفيذ",
      ),
    ).toBe("تعارضت إعادة المحاولة مع طلب سابق. حدّث الصفحة ثم أعد المحاولة");
    expect(
      getUserErrorMessage(
        { message: "must_change_password" },
        "تعذر المتابعة",
      ),
    ).toBe("يجب تغيير كلمة المرور قبل المتابعة");
  });
});
