import { validatePaymentProof } from "./settings-api";

describe("validatePaymentProof", () => {
  it("accepts supported images and PDF files", () => {
    const image = new File(["proof"], "proof.png", { type: "image/png" });
    const pdf = new File(["proof"], "proof.pdf", {
      type: "application/pdf",
    });

    expect(validatePaymentProof(image)).toBeNull();
    expect(validatePaymentProof(pdf)).toBeNull();
  });

  it("rejects unsupported formats", () => {
    const file = new File(["proof"], "proof.svg", {
      type: "image/svg+xml",
    });

    expect(validatePaymentProof(file)).toBe(
      "اختر صورة JPG أو PNG أو ملف PDF",
    );
  });

  it("rejects files larger than ten megabytes", () => {
    const file = new File([new Uint8Array(10 * 1024 * 1024 + 1)], "proof.jpg", {
      type: "image/jpeg",
    });

    expect(validatePaymentProof(file)).toBe(
      "حجم إثبات الدفع يجب ألا يتجاوز 10 ميجابايت",
    );
  });
});
