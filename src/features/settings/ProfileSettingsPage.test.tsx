import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TestProviders } from "@/test/TestProviders";
import { ProfileSettingsPage } from "./ProfileSettingsPage";
import { updateOwnProfile } from "./settings-api";

vi.mock("./settings-api", () => ({
  updateOwnProfile: vi.fn(),
}));

describe("ProfileSettingsPage", () => {
  beforeEach(() => {
    vi.mocked(updateOwnProfile).mockReset();
    vi.mocked(updateOwnProfile).mockResolvedValue();
  });

  it("validates the display name before saving", async () => {
    const user = userEvent.setup();
    render(
      <TestProviders>
        <ProfileSettingsPage />
      </TestProviders>,
    );

    const name = screen.getByLabelText("الاسم الظاهر");
    await user.clear(name);
    await user.type(name, "م");
    await user.click(screen.getByRole("button", { name: "حفظ التغييرات" }));

    expect(
      screen.getByText("الاسم يجب أن يكون بين حرفين و80 حرفًا"),
    ).toBeInTheDocument();
    expect(updateOwnProfile).not.toHaveBeenCalled();
  });

  it("saves a valid name and timezone", async () => {
    const user = userEvent.setup();
    render(
      <TestProviders>
        <ProfileSettingsPage />
      </TestProviders>,
    );

    const name = screen.getByLabelText("الاسم الظاهر");
    await user.clear(name);
    await user.type(name, "محمد علي");
    await user.selectOptions(screen.getByLabelText("المنطقة الزمنية"), "UTC");
    await user.click(screen.getByRole("button", { name: "حفظ التغييرات" }));

    expect(updateOwnProfile).toHaveBeenCalledWith({
      userId: "00000000-0000-4000-8000-000000000001",
      displayName: "محمد علي",
      timezone: "UTC",
    });
  });
});
