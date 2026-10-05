export const getUserAvatar = (user: any): string | undefined => {
  if (!user) return undefined;
  return user.avatarUrl || user.avatar || user.profilePicture || user.photoURL || user.picture || user.image;
};
