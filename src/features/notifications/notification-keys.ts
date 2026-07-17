export const notificationKeys = {
  all: ["notifications"] as const,
  list: (userId: string | undefined) =>
    ["notifications", userId] as const,
  unread: (userId: string | undefined) =>
    ["notifications-unread", userId] as const,
};

export async function invalidateNotificationQueries(
  queryClient: {
    invalidateQueries: (opts: { queryKey: readonly unknown[] }) => Promise<void>;
  },
  userId: string | undefined,
) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: notificationKeys.list(userId) }),
    queryClient.invalidateQueries({
      queryKey: notificationKeys.unread(userId),
    }),
  ]);
}
