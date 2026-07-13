export function getAuthErrorMessage(error: {
  message?: string;
  code?: string;
}): string {
  const message = error.message?.toLowerCase() ?? "";
  const code = error.code?.toLowerCase() ?? "";

  if (
    message.includes("invalid login credentials") ||
    code === "invalid_credentials"
  ) {
    return "البريد الإلكتروني أو كلمة المرور غير صحيحة";
  }

  if (
    message.includes("user already registered") ||
    code === "user_already_exists"
  ) {
    return "تعذر إنشاء الحساب. جرّب تسجيل الدخول أو استعادة كلمة المرور.";
  }

  if (message.includes("email not confirmed")) {
    return "يرجى تأكيد بريدك الإلكتروني أولاً";
  }

  if (
    code.includes("rate_limit") ||
    message.includes("rate limit") ||
    message.includes("security purposes")
  ) {
    return "تم إرسال طلبات كثيرة. انتظر قليلًا ثم حاول مرة أخرى.";
  }

  if (code === "same_password" || message.includes("same password")) {
    return "اختر كلمة مرور جديدة تختلف عن الحالية.";
  }

  if (
    message.includes("password") &&
    (message.includes("weak") || message.includes("least"))
  ) {
    return "كلمة المرور ضعيفة. استوفِ المتطلبات الظاهرة في النموذج.";
  }

  if (
    message.includes("breach") ||
    message.includes("pwned") ||
    message.includes("compromised")
  ) {
    return "كلمة المرور ظهرت في تسريب سابق. اختر كلمة مرور جديدة وفريدة.";
  }

  if (
    message.includes("expired") ||
    message.includes("invalid token") ||
    code.includes("otp_expired")
  ) {
    return "انتهت صلاحية الرابط. اطلب رابطًا جديدًا.";
  }

  if (
    message.includes("failed to fetch") ||
    message.includes("network") ||
    code === "request_timeout"
  ) {
    return "تعذر الاتصال بالخدمة. تحقق من الإنترنت وحاول مرة أخرى.";
  }

  return "تعذر إكمال العملية. حاول مرة أخرى.";
}
